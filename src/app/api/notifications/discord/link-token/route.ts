import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes — OAuth flows shouldn't drag

// Issues an OAuth state token and returns the Discord authorize URL. The
// token id rides in the `state` query parameter; the callback validates
// (token exists, unused, unexpired, owned by the same authenticated user)
// before binding the Discord identity to the account.
export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
  const baseUrl = process.env.AUTH_URL;
  if (!clientId || !process.env.DISCORD_CLIENT_SECRET || !baseUrl) {
    return NextResponse.json(
      { error: "Discord is not configured" },
      { status: 503 }
    );
  }

  // Lazy cleanup so a user clicking "Link" repeatedly doesn't accumulate
  // orphan rows.
  await db.discordLinkToken.deleteMany({
    where: {
      userEmail: session.user.email,
      OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }],
    },
  });

  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  const token = await db.discordLinkToken.create({
    data: { userEmail: session.user.email, expiresAt },
  });

  const redirectUri = `${baseUrl.replace(/\/$/, "")}/api/discord/oauth-callback`;
  const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify");
  authorizeUrl.searchParams.set("state", token.id);
  // `prompt=none` skips the consent screen for users who've already
  // authorized this app — quicker re-link UX.
  authorizeUrl.searchParams.set("prompt", "none");

  return NextResponse.json({
    url: authorizeUrl.toString(),
    expiresAt: expiresAt.toISOString(),
  });
}
