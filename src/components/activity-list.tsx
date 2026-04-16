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
};

export function ActivityList({ activities }: { activities: ActivityData[] }) {
  const { registered, managing, pendingInvitation } = useActivityStatus();

  return (
    <div className="flex flex-col gap-4">
      {activities.map((activity) => (
        <ActivityCard
          key={activity.id}
          {...activity}
          registered={registered.has(activity.id)}
          managing={managing.has(activity.id)}
          pendingInvitation={pendingInvitation.has(activity.id)}
        />
      ))}
    </div>
  );
}
