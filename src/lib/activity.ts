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
