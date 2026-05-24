import { NextRequest, NextResponse, after } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { sendComanagerInvitation } from "@/lib/email";
import { findSameDayCommitment } from "@/lib/activity";
import { cacheTags } from "@/lib/cache-tags";
import {
  broadcast,
  notify,
  activityCreatedDispatch,
  comanagerInvitedDispatch,
} from "@/lib/notify";
import { announceToDiscordChannel } from "@/lib/notify/channels/discord";
import { getBaseUrl } from "@/lib/url";
import { randomUUID } from "crypto";

export async function GET() {
  const activities = await db.activity.findMany({
    include: {
      activityManagers: {
        where: { status: "confirmed" },
        include: { user: true },
      },
      _count: {
        select: {
          registrations: {
            where: { status: { in: ["registration_confirmed", "attended"] } },
          },
        },
      },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(activities);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session, "activities.create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      title,
      description,
      coverImgId,
      homepageThumbnailImgId,
      registrationHeroImgId,
      deadline,
      date,
      capacity = 0,
      maximumRegistration = 0,
      userEmail,
      comanagerEmails = [],
      metadata,
      qrCodeUrl,
    } = body;

    if (!title || !deadline || !date || !userEmail) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate deadline is in the future. The form sends a full ISO
    // datetime (hour-precise); fall back to end-of-day for any legacy
    // date-only ("YYYY-MM-DD") caller.
    const deadlineDate = new Date(
      /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? `${deadline}T23:59:59` : deadline
    );
    const activityDate = new Date(date + "T06:00:00");
    const now = new Date();

    if (deadlineDate <= now) {
      return NextResponse.json(
        { error: "Deadline must be in the future" },
        { status: 400 }
      );
    }

    if (activityDate <= deadlineDate) {
      return NextResponse.json(
        { error: "Activity date must be after the deadline" },
        { status: 400 }
      );
    }

    // Check intern rule: intern managers need at least one qualified comanager
    const manager = await db.user.findUnique({
      where: { email: userEmail },
      include: { managerProfile: true },
    });
    if (manager?.managerProfile?.intern && comanagerEmails.length > 0) {
      const qualifiedComanagers = await db.managerProfile.findMany({
        where: {
          userEmail: { in: comanagerEmails },
          intern: false,
        },
      });
      if (qualifiedComanagers.length === 0) {
        return NextResponse.json(
          { error: "Intern managers must have at least one qualified co-manager" },
          { status: 400 }
        );
      }
    }

    // Block creation if the creator already has a confirmed commitment
    // (member registration or another management role) on the same day.
    // The creator is auto-confirmed as manager below, so this would
    // otherwise bypass the same-day rule enforced elsewhere.
    const creatorConflict = await findSameDayCommitment(userEmail, activityDate);
    if (creatorConflict) {
      const label = creatorConflict.role === "manager"
        ? `You are already managing "${creatorConflict.title}" on the same day.`
        : `You are already confirmed for "${creatorConflict.title}" on the same day.`;
      return NextResponse.json({ error: label }, { status: 400 });
    }

    // Generate tokens for comanager invitations
    const comanagerData = comanagerEmails.map((email: string) => ({
      userEmail: email,
      role: "comanager" as const,
      status: "invited" as const,
      token: randomUUID(),
    }));

    const activity = await db.activity.create({
      data: {
        title,
        description: description || "",
        coverImgId: coverImgId || "",
        homepageThumbnailImgId: homepageThumbnailImgId || null,
        registrationHeroImgId: registrationHeroImgId || null,
        deadline: deadlineDate,
        date: activityDate,
        capacity,
        maximumRegistration,
        metadata: {
          ...(metadata || {}),
          ...(qrCodeUrl ? { qrCodeUrl } : {}),
        },
        status: "open",
        activityManagers: {
          create: [
            { userEmail, role: "manager", status: "confirmed" },
            ...comanagerData,
          ],
        },
      },
    });

    // Send invitation emails to comanagers + push notifications. The push
    // is in addition to the email since not every comanager checks email
    // promptly; both are fire-and-forget so the response isn't blocked.
    const baseUrl = getBaseUrl();
    const managerName = session.user?.name || userEmail;
    for (const cm of comanagerData) {
      const comanager = await db.user.findUnique({ where: { email: cm.userEmail } });
      const inviteUrl = `${baseUrl}/invitations/comanager/${cm.token}`;
      await sendComanagerInvitation(
        cm.userEmail,
        comanager?.name || cm.userEmail,
        title,
        inviteUrl
      ).catch((err) => console.error("[EMAIL] Comanager invite failed:", err));

      const dispatch = comanagerInvitedDispatch({
        activityId: activity.id,
        activityTitle: title,
        inviterName: managerName,
        url: inviteUrl,
      });
      after(async () => {
        try {
          await notify(cm.userEmail, dispatch);
        } catch (err) {
          console.error("[notify] comanager_invited failed:", err);
        }
      });
    }

    // Broadcast "activity created" only if the creator is a non-intern
    // manager. For intern-created activities the broadcast is deferred until
    // the first non-intern co-manager accepts their invitation (handled in
    // /api/invitations/comanager/[token]).
    //
    // `after()` keeps the function alive past the response so the broadcast
    // (potentially hundreds of pushes) actually finishes. Vercel will kill
    // a bare unawaited promise once the response is sent.
    const creatorIsIntern = manager?.managerProfile?.intern === true;
    if (!creatorIsIntern) {
      const baseUrl = getBaseUrl();
      const dispatch = activityCreatedDispatch({
        activityId: activity.id,
        activityTitle: title,
        url: `${baseUrl}/activities/${activity.id}`,
      });
      after(async () => {
        try {
          await broadcast(dispatch);
        } catch (err) {
          console.error("[notify] activity_created broadcast failed:", err);
        }
        // Post to the public Discord announcements channel (separate from
        // the per-user DM fan-out; no-op if the channel isn't configured).
        try {
          await announceToDiscordChannel(dispatch.meta);
        } catch (err) {
          console.error("[notify] activity_created announcement failed:", err);
        }
      });
    }

    // expire: 0 so the new activity shows up on the homepage immediately,
    // not after the background refresh from "max"'s stale-while-revalidate.
    revalidateTag(cacheTags.activities, { expire: 0 });
    return NextResponse.json({ id: activity.id });
  } catch (error) {
    console.error("Create activity error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
