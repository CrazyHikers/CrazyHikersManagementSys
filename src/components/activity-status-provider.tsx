"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type ActivityStatus = {
  registered: Set<string>;
  managing: Set<string>;
};

const defaultStatus: ActivityStatus = {
  registered: new Set(),
  managing: new Set(),
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
        });
      })
      .catch(() => {});
  }, [session?.user]);

  return status;
}
