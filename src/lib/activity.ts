import type { ActivityStatus } from "@/generated/prisma/enums";
import { db } from "./db";

export type ActivityDisplayStatus = ActivityStatus | "closed";

/**
 * Returns the status to display for an activity. An `open` activity whose
 * registration deadline has passed is shown as `closed`, even though the
 * underlying DB row is still `open` (so managers can continue managing
 * registrations until they manually finish or cancel the activity).
 */
export function getDisplayStatus(activity: {
  status: ActivityStatus;
  deadline: Date | string;
}): ActivityDisplayStatus {
  if (activity.status === "open" && new Date(activity.deadline) <= new Date()) {
    return "closed";
  }
  return activity.status;
}

/**
 * Returns the conflicting activity (if any) for a user on a given date,
 * treating both confirmed registrations and confirmed management
 * (manager/comanager) roles as commitments that exclude other activities.
 * Skips cancelled activities. Optionally excludes a specific activityId
 * (the one being registered for / confirmed).
 */
export async function findSameDayCommitment(
  userEmail: string,
  activityDate: Date,
  excludeActivityId?: string
): Promise<{ activityId: string; title: string; role: "member" | "manager" } | null> {
  const dayStart = new Date(activityDate.getFullYear(), activityDate.getMonth(), activityDate.getDate());
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const dateFilter = {
    date: { gte: dayStart, lt: dayEnd },
    status: { not: "cancelled" as const },
    ...(excludeActivityId ? { id: { not: excludeActivityId } } : {}),
  };

  const [reg, mgmt] = await Promise.all([
    db.registration.findFirst({
      where: {
        userEmail,
        status: "registration_confirmed",
        activity: dateFilter,
      },
      include: { activity: { select: { id: true, title: true } } },
    }),
    db.activityManager.findFirst({
      where: {
        userEmail,
        status: "confirmed",
        activity: dateFilter,
      },
      include: { activity: { select: { id: true, title: true } } },
    }),
  ]);

  if (reg) return { activityId: reg.activity.id, title: reg.activity.title, role: "member" };
  if (mgmt) return { activityId: mgmt.activity.id, title: mgmt.activity.title, role: "manager" };
  return null;
}

/**
 * Returns the effective submission count for one or more activities,
 * excluding "phantom" pending registrations — rows where the user already
 * has a confirmed commitment (member or manager) on the same day for a
 * different activity. Phantom rows can never be confirmed, so they should
 * not occupy a slot against `maximumRegistration`.
 *
 * Confirmed rows always count.
 *
 * Returns a Map of activityId → effective submission count.
 */
export async function computeEffectiveSubmissionCounts(
  activities: { id: string; date: Date }[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (activities.length === 0) return result;

  const activityIds = activities.map((a) => a.id);
  const activityDateById = new Map(activities.map((a) => [a.id, a.date]));

  // Fetch all pending + confirmed registrations for these activities
  const regs = await db.registration.findMany({
    where: {
      activityId: { in: activityIds },
      status: { in: ["registered", "registration_confirmed"] },
    },
    select: { activityId: true, userEmail: true, status: true },
  });

  // Initialize counts
  for (const id of activityIds) result.set(id, 0);

  // For pending registrations, check whether the user has a same-day
  // confirmed commitment on another activity. We batch all the pending
  // rows' users and collect their confirmed commitments across the
  // relevant date window in two queries.
  const pendingRegs = regs.filter((r) => r.status === "registered");
  const pendingUserEmails = Array.from(new Set(pendingRegs.map((r) => r.userEmail)));

  // Build day windows touched by these activities
  const dayWindows = Array.from(
    new Set(
      activities.map((a) => {
        const d = new Date(a.date);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      })
    )
  ).map((ms) => {
    const start = new Date(ms);
    const end = new Date(ms);
    end.setDate(end.getDate() + 1);
    return { start, end };
  });

  let confirmedCommitments: { userEmail: string; activityId: string; date: Date }[] = [];
  if (pendingUserEmails.length > 0 && dayWindows.length > 0) {
    const dateOrFilter = dayWindows.map((w) => ({ date: { gte: w.start, lt: w.end } }));
    const [mRows, gRows] = await Promise.all([
      db.registration.findMany({
        where: {
          userEmail: { in: pendingUserEmails },
          status: "registration_confirmed",
          activity: { status: { not: "cancelled" }, OR: dateOrFilter },
        },
        select: { userEmail: true, activityId: true, activity: { select: { date: true } } },
      }),
      db.activityManager.findMany({
        where: {
          userEmail: { in: pendingUserEmails },
          status: "confirmed",
          activity: { status: { not: "cancelled" }, OR: dateOrFilter },
        },
        select: { userEmail: true, activityId: true, activity: { select: { date: true } } },
      }),
    ]);
    confirmedCommitments = [
      ...mRows.map((r) => ({ userEmail: r.userEmail, activityId: r.activityId, date: r.activity.date })),
      ...gRows.map((r) => ({ userEmail: r.userEmail, activityId: r.activityId, date: r.activity.date })),
    ];
  }

  // Index commitments by "userEmail|YYYY-MM-DD" → Set<activityId>
  const commitmentIndex = new Map<string, Set<string>>();
  for (const c of confirmedCommitments) {
    const d = new Date(c.date);
    const key = `${c.userEmail}|${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!commitmentIndex.has(key)) commitmentIndex.set(key, new Set());
    commitmentIndex.get(key)!.add(c.activityId);
  }

  for (const r of regs) {
    if (r.status === "registration_confirmed") {
      result.set(r.activityId, (result.get(r.activityId) ?? 0) + 1);
      continue;
    }
    // Pending: exclude if user has a confirmed commitment on the same day elsewhere
    const actDate = activityDateById.get(r.activityId);
    if (!actDate) continue;
    const key = `${r.userEmail}|${actDate.getFullYear()}-${actDate.getMonth()}-${actDate.getDate()}`;
    const commits = commitmentIndex.get(key);
    const isPhantom = commits && Array.from(commits).some((cid) => cid !== r.activityId);
    if (!isPhantom) {
      result.set(r.activityId, (result.get(r.activityId) ?? 0) + 1);
    }
  }

  return result;
}
