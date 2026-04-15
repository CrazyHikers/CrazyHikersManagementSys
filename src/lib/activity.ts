import type { ActivityStatus } from "@/generated/prisma/enums";

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
