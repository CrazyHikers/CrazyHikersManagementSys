// prisma/seed-matchmaking-520.ts
//
// Usage:
//   npx tsx -r dotenv/config prisma/seed-matchmaking-520.ts <activity-id>
//
// Marks an existing activity as the 520 matchmaking event by setting:
//   metadata.template = "matchmaking_520"
//   metadata.slug = "520"
//   metadata.privacyNotice = (fixed text)
// Existing metadata keys (route, distance, etc.) are preserved.

import { db } from "../src/lib/db";

const PRIVACY_NOTICE =
  "您的个人信息将仅用于本次活动的组织和服务，包括但不限于匹配对象的推荐、活动的安排等。我们将严格保护您的个人信息，不会将其用于任何非法目的，也不会未经您的同意向任何第三方透露。";

async function main() {
  const activityId = process.argv[2];
  if (!activityId) {
    console.error("Usage: npx tsx -r dotenv/config scripts/seed-matchmaking-520.ts <activity-id>");
    process.exit(1);
  }
  const current = await db.activity.findUnique({ where: { id: activityId } });
  if (!current) {
    console.error(`Activity ${activityId} not found.`);
    process.exit(1);
  }
  const existing = (current.metadata as Record<string, unknown> | null) ?? {};
  const next = {
    ...existing,
    template: "matchmaking_520",
    slug: "520",
    privacyNotice: PRIVACY_NOTICE,
  };
  await db.activity.update({
    where: { id: activityId },
    data: { metadata: next },
  });
  console.log("OK — activity tagged as matchmaking_520:");
  console.log(JSON.stringify(next, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
