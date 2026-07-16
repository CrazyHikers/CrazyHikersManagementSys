"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Radio, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PollStatus } from "@/lib/polls/types";

type ActionsCopy = {
  publish: string;
  publishConfirm: string;
  published: string;
  close: string;
  closeConfirm: string;
  closed: string;
  extend: string;
  extended: string;
  working: string;
  error: string;
};

function toLocalDateTime(value: string): string {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export function PollAdminActions({
  pollId,
  status,
  deadline,
  copy,
}: {
  pollId: string;
  status: PollStatus;
  deadline: string;
  copy: ActionsCopy;
}) {
  const router = useRouter();
  const [nextDeadline, setNextDeadline] = useState(toLocalDateTime(deadline));
  const [working, setWorking] = useState(false);

  async function request(url: string, init: RequestInit, success: string) {
    setWorking(true);
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || copy.error);
      }
      toast.success(success);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.error);
    } finally {
      setWorking(false);
    }
  }

  if (status === "draft") {
    return (
      <Button
        disabled={working}
        onClick={() => {
          if (!window.confirm(copy.publishConfirm)) return;
          void request(
            `/api/polls/${pollId}/publish`,
            { method: "POST" },
            copy.published,
          );
        }}
        className="bg-emerald-700 hover:bg-emerald-800"
      >
        <Radio className="size-4" />
        {working ? copy.working : copy.publish}
      </Button>
    );
  }

  if (status === "closed") return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 lg:flex-row lg:items-end">
      <div className="flex-1 space-y-2">
        <label htmlFor="extended-deadline" className="text-sm font-medium text-amber-950">
          {copy.extend}
        </label>
        <Input
          id="extended-deadline"
          type="datetime-local"
          value={nextDeadline}
          onChange={(event) => setNextDeadline(event.target.value)}
          className="bg-white"
        />
      </div>
      <Button
        variant="outline"
        disabled={working}
        onClick={() =>
          void request(
            `/api/polls/${pollId}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                deadline: new Date(nextDeadline).toISOString(),
              }),
            },
            copy.extended,
          )
        }
        className="bg-white"
      >
        <CalendarClock className="size-4" />
        {working ? copy.working : copy.extend}
      </Button>
      <Button
        variant="destructive"
        disabled={working}
        onClick={() => {
          if (!window.confirm(copy.closeConfirm)) return;
          void request(
            `/api/polls/${pollId}/close`,
            { method: "POST" },
            copy.closed,
          );
        }}
      >
        <Square className="size-4" />
        {working ? copy.working : copy.close}
      </Button>
    </div>
  );
}
