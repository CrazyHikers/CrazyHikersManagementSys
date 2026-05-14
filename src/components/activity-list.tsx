"use client";

import { ActivityCard } from "@/components/activity-card";
import { useActivityStatus } from "@/components/activity-status-provider";

type ActivityData = {
  id: string;
  title: string;
  description: string;
  coverImgUrl: string | null;
  date: string;
  deadline: string;
  capacity: number;
  currentRegistrations: number;
  maximumRegistration: number | null;
  submissionCount: number;
  managerNames: string;
  template?: string | null;
};

function dateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ActivityList({ activities }: { activities: ActivityData[] }) {
  const { registered, managing, pendingInvitation, conflictsByDate } = useActivityStatus();

  return (
    <div className="flex flex-col gap-4">
      {activities.map((activity) => {
        const conflict = conflictsByDate[dateKey(activity.date)];
        // Don't flag a conflict against the user's own commitment — that
        // activity is already badged as `registered` or `managing`.
        const sameDayConflict =
          conflict && conflict.activityId !== activity.id ? conflict : undefined;
        return (
          <ActivityCard
            key={activity.id}
            {...activity}
            registered={registered.has(activity.id)}
            managing={managing.has(activity.id)}
            pendingInvitation={pendingInvitation.has(activity.id)}
            sameDayConflict={sameDayConflict}
          />
        );
      })}
    </div>
  );
}
