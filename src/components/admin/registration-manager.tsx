"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Registration = {
  memberId: string;
  memberName: string;
  memberEmail: string;
  status: string;
  registeredAt: string;
  confirmedAt: string | null;
  notes: string | null;
  totalAttended: number;
  hasValidWaiver: boolean;
  yellowFlags: number;
  redFlags: number;
  isBanned: boolean;
};

const statusColors: Record<string, string> = {
  registered: "bg-blue-100 text-blue-800",
  registration_confirmed: "bg-green-100 text-green-800",
  attended: "bg-emerald-100 text-emerald-800",
  absent: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  registered: "Registered",
  registration_confirmed: "Confirmed",
  attended: "Attended",
  absent: "Absent",
};

export function RegistrationManager({
  activityId,
  activityStatus,
  initialRegistrations,
}: {
  activityId: string;
  activityStatus: string;
  initialRegistrations: Registration[];
}) {
  const t = useTranslations("admin.activities");
  const [registrations, setRegistrations] = useState(initialRegistrations);
  const [saving, setSaving] = useState<string | null>(null);
  const [flagging, setFlagging] = useState<string | null>(null);

  // Auto-save on status change
  const updateStatus = useCallback(
    async (memberId: string, newStatus: string) => {
      setSaving(memberId);
      try {
        const res = await fetch(
          `/api/activities/${activityId}/registrations`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ memberId, status: newStatus }),
          }
        );
        if (!res.ok) throw new Error("Failed to update");

        setRegistrations((prev) =>
          prev.map((r) =>
            r.memberId === memberId ? { ...r, status: newStatus } : r
          )
        );
        toast.success(`${statusLabels[newStatus]}`);
      } catch {
        toast.error("Failed to update");
      } finally {
        setSaving(null);
      }
    },
    [activityId]
  );

  // Flag a member (yellow or red)
  const flagMember = useCallback(
    async (memberId: string, flagType: "yellow" | "red") => {
      setFlagging(memberId);
      try {
        const res = await fetch(`/api/members/${memberId}/flag`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ flagType, activityId }),
        });
        if (!res.ok) throw new Error("Failed to flag");
        toast.success(
          `${flagType === "yellow" ? "Yellow" : "Red"} flag applied`
        );
      } catch {
        toast.error("Failed to flag member");
      } finally {
        setFlagging(null);
      }
    },
    [activityId]
  );

  const deregister = useCallback(
    async (memberId: string) => {
      try {
        const res = await fetch(
          `/api/activities/${activityId}/registrations`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ memberId }),
          }
        );
        if (!res.ok) throw new Error("Failed");
        setRegistrations((prev) =>
          prev.filter((r) => r.memberId !== memberId)
        );
        toast.success("Removed");
      } catch {
        toast.error("Failed");
      }
    },
    [activityId]
  );

  const isEditable = ["open", "closed"].includes(activityStatus);

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground mb-4">
        {registrations.length} registrations · Changes save automatically
      </div>

      {registrations.map((reg) => (
        <Card
          key={reg.memberId}
          className={`${saving === reg.memberId ? "opacity-60" : ""}`}
        >
          <CardContent className="pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{reg.memberName}</span>
                  <Badge className={statusColors[reg.status]}>
                    {statusLabels[reg.status]}
                  </Badge>
                  {!reg.hasValidWaiver && (
                    <Badge variant="destructive" className="text-xs">
                      No waiver
                    </Badge>
                  )}
                  {reg.yellowFlags > 0 && (
                    <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                      {reg.yellowFlags} yellow
                    </Badge>
                  )}
                  {reg.redFlags > 0 && (
                    <Badge className="bg-red-100 text-red-800 text-xs">
                      {reg.redFlags} red
                    </Badge>
                  )}
                  {reg.isBanned && (
                    <Badge variant="destructive" className="text-xs">
                      Banned
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {reg.memberEmail}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Attended {reg.totalAttended} activities ·{" "}
                  {new Date(reg.registeredAt).toLocaleDateString()}
                </div>
                {reg.notes && (
                  <div className="text-sm mt-2 p-2 bg-gray-50 rounded text-gray-600">
                    {reg.notes}
                  </div>
                )}
              </div>

              {isEditable && (
                <div className="flex flex-col gap-2 items-end flex-shrink-0">
                  {/* Status change dropdown — auto-saves */}
                  <Select
                    value={reg.status}
                    onValueChange={(val) => val && updateStatus(reg.memberId, val)}
                  >
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="registered">Registered</SelectItem>
                      <SelectItem value="registration_confirmed">
                        Confirmed
                      </SelectItem>
                      <SelectItem value="attended">Attended</SelectItem>
                      <SelectItem value="absent">Absent</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Flag buttons */}
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs text-yellow-600 border-yellow-300 hover:bg-yellow-50"
                      onClick={() => flagMember(reg.memberId, "yellow")}
                      disabled={flagging === reg.memberId}
                    >
                      ⚠ Yellow
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50"
                      onClick={() => flagMember(reg.memberId, "red")}
                      disabled={flagging === reg.memberId}
                    >
                      🚫 Red
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => deregister(reg.memberId)}
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {registrations.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No registrations yet
        </div>
      )}
    </div>
  );
}
