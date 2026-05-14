// prisma/seed-matchmaking-520.ts
//
// Usage:
//   npx tsx -r dotenv/config prisma/seed-matchmaking-520.ts <activity-id> [<slug>]
//
// Marks an existing activity as the 520 matchmaking event by setting:
//   metadata.template = "matchmaking_520"
//   metadata.slug = <slug>  (defaults to "520"; pass e.g. "520-de" / "520-fr"
//                            when running for multiple region-split events)
//   metadata.privacyNotice = (fixed text)
// Existing metadata keys (route, distance, etc.) are preserved.
//
// Slugs are globally unique across activities. If the chosen slug is
// already in use by another activity, the script aborts and prints the
// conflicting activity — pick a different slug or change the slug on
// the existing activity via the dashboard (Dev Controls card on
// /dashboard/activity-view/<id>).

import { db } from "../src/lib/db";

const PRIVACY_NOTICE =
  "您的个人信息将仅用于本次活动的组织和服务，包括但不限于匹配对象的推荐、活动的安排等。我们将严格保护您的个人信息，不会将其用于任何非法目的，也不会未经您的同意向任何第三方透露。";

async function main() {
  const activityId = process.argv[2];
  const slug = (process.argv[3] || "520").trim();
  if (!activityId) {
    console.error(
      "Usage: npx tsx -r dotenv/config prisma/seed-matchmaking-520.ts <activity-id> [<slug>]"
    );
    process.exit(1);
  }
  if (!/^[a-zA-Z0-9_\-]+$/.test(slug) || slug.length > 64) {
    console.error(
      `Invalid slug "${slug}": must be 1-64 chars, letters/digits/_/- only.`
    );
    process.exit(1);
  }

  const current = await db.activity.findUnique({ where: { id: activityId } });
  if (!current) {
    console.error(`Activity ${activityId} not found.`);
    process.exit(1);
  }

  // Mirror the uniqueness check the /api/activities/[id]/slug endpoint
  // enforces, so direct DB writes via this script can't silently break
  // /events/<slug> resolution.
  const conflict = await db.activity.findFirst({
    where: {
      id: { not: activityId },
      metadata: { path: ["slug"], equals: slug },
    },
    select: { id: true, title: true },
  });
  if (conflict) {
    console.error(
      `Slug "${slug}" is already used by another activity: ${conflict.title} (${conflict.id}).`
    );
    console.error(
      `Choose a different slug (e.g. "${slug}-de" / "${slug}-fr") or change the existing activity's slug via the dashboard first.`
    );
    process.exit(1);
  }

  const existing = (current.metadata as Record<string, unknown> | null) ?? {};
  const next = {
    ...existing,
    template: "matchmaking_520",
    slug,
    privacyNotice: PRIVACY_NOTICE,
  };
  await db.activity.update({
    where: { id: activityId },
    data: { metadata: next },
  });
  console.log("OK — activity tagged as matchmaking_520:");
  console.log(JSON.stringify(next, null, 2));
  console.log(`\nReachable at /events/${slug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
