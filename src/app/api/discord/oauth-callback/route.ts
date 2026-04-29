import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isMemberOfGuild } from "@/lib/notify/channels/discord";

// Discord redirects users here after they authorize. We:
//   1. validate the state token (anti-CSRF + identifies the user)
//   2. exchange the code for a short-lived access token
//   3. fetch the Discord user id + username (`identify` scope)
//   4. verify they're a member of our configured guild — without this
//      the bot can't DM them, so the link would silently fail at first
//      send. Cheaper to fail-fast at link time.
//   5. upsert the subscription, mark the token used, and bounce them
//      back to the profile page with a status query parameter.
//
// All terminal states (success or each failure mode) redirect to
// /dashboard/my-profile?discord=<status>; the settings UI surfaces it
// via toast / refreshed status.
export async function GET(request: NextRequest) {
  // Stays on AUTH_URL (not getBaseUrl()) because both the redirect_uri sent
  // to Discord during token exchange below AND the registered redirect URI
  // in the Discord developer portal are tied to the canonical domain. The
  // OAuth flow is production-only; preview environments can't link unless
  // their URL is registered with Discord too.
  const baseUrl = (process.env.AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  const profileUrl = `${baseUrl}/dashboard/my-profile`;

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(`${profileUrl}?discord=denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${profileUrl}?discord=bad_request`);
  }

  // Validate the state token. Has to belong to the currently signed-in
  // user — without this check, an attacker could trick a victim into
  // visiting a link that binds the attacker's Discord to the victim's
  // account.
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect(`${profileUrl}?discord=session_expired`);
  }

  const token = await db.discordLinkToken.findUnique({ where: { id: state } });
  const now = new Date();
  if (
    !token ||
    token.usedAt ||
    token.expiresAt < now ||
    token.userEmail !== session.user.email
  ) {
    return NextResponse.redirect(`${profileUrl}?discord=invalid_state`);
  }

  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${profileUrl}?discord=not_configured`);
  }

  // 2. Exchange the code for an access token. Form-encoded per OAuth2 spec.
  // Must exactly match the redirect_uri sent in step 1 (link-token route)
  // and the value registered in the Discord developer portal — see comment
  // at the top of GET about why this stays on AUTH_URL.
  const redirectUri = `${baseUrl}/api/discord/oauth-callback`;
  const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenRes.ok) {
    console.error(
      "[discord/oauth] token exchange failed:",
      tokenRes.status,
      await tokenRes.text().catch(() => "")
    );
    return NextResponse.redirect(`${profileUrl}?discord=exchange_failed`);
  }
  const tokenData = (await tokenRes.json()) as { access_token: string };

  // 3. Fetch the Discord user id + username with the access token.
  const userRes = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!userRes.ok) {
    console.error(
      "[discord/oauth] /users/@me failed:",
      userRes.status,
      await userRes.text().catch(() => "")
    );
    return NextResponse.redirect(`${profileUrl}?discord=identify_failed`);
  }
  const discordUser = (await userRes.json()) as {
    id: string;
    username: string;
    global_name?: string;
  };

  // 4. Confirm guild membership BEFORE saving — bot can only DM users in
  // a shared server, so a non-member subscription would silently fail.
  const inGuild = await isMemberOfGuild(discordUser.id);
  if (!inGuild) {
    return NextResponse.redirect(`${profileUrl}?discord=not_in_guild`);
  }

  // 5. Bind. Transactional so a partial failure can't leave inconsistent
  // state. The discord_user_id @unique constraint guarantees one Discord
  // identity → one Crazy Hikers account at a time.
  try {
    await db.$transaction([
      db.discordSubscription.upsert({
        where: { userEmail: token.userEmail },
        create: {
          userEmail: token.userEmail,
          discordUserId: discordUser.id,
          username: discordUser.global_name || discordUser.username,
        },
        update: {
          discordUserId: discordUser.id,
          username: discordUser.global_name || discordUser.username,
          // Wipe cached DM channel so we re-open it on the next send —
          // safer than carrying a possibly-stale id across re-links.
          dmChannelId: null,
        },
      }),
      db.discordLinkToken.update({
        where: { id: token.id },
        data: { usedAt: now },
      }),
    ]);
  } catch (err) {
    // Most likely cause: discordUserId is already bound to a different
    // Crazy Hikers account (the @unique constraint).
    console.error("[discord/oauth] bind failed:", err);
    return NextResponse.redirect(`${profileUrl}?discord=already_linked`);
  }

  return NextResponse.redirect(`${profileUrl}?discord=linked`);
}
