"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export type ConflictInfo = { activityId: string; title: string; role: "member" | "manager" };

type ActivityStatus = {
  registered: Set<string>;
  managing: Set<string>;
  pendingInvitation: Set<string>;
  conflictsByDate: Record<string, ConflictInfo>;
};

const defaultStatus: ActivityStatus = {
  registered: new Set(),
  managing: new Set(),
  pendingInvitation: new Set(),
  conflictsByDate: {},
};

export function useActivityStatus() {
  const { data: session } = useSession();
  const [status, setStatus] = useState<ActivityStatus>(defaultStatus);

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/activities/my-status")
      .then((res) => res.json())
      .then((data) => {
        setStatus({
          registered: new Set(data.registered),
          managing: new Set(data.managing),
          pendingInvitation: new Set(data.pendingInvitation ?? []),
          conflictsByDate: data.conflictsByDate ?? {},
        });
      })
      .catch(() => {});
  }, [session?.user]);

  return status;
}
