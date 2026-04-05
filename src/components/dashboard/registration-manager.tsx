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

type RegistrationFormData = {
  expectations?: string;
  dietaryRestrictions?: string;
  bringItems?: string;
  isCrazyHikerMember?: string;
  fitnessStatement?: string;
  confirmRules?: boolean;
  confirmInfo?: boolean;
};

type Registration = {
  userEmail: string;
  userName: string;
  userEmailDisplay: string;
  status: string;
  registeredAt: string;
  confirmedAt: string | null;
  notes: string | null;
  formData?: RegistrationFormData | null;
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
  const t = useTranslations("dashboard.activities");
  const [registrations, setRegistrations] = useState(initialRegistrations);
  const [saving, setSaving] = useState<string | null>(null);
  const [flagging, setFlagging] = useState<string | null>(null);
  const [expandedFormData, setExpandedFormData] = useState<Set<string>>(new Set());

  function toggleFormData(userEmail: string) {
    setExpandedFormData((prev) => {
      const next = new Set(prev);
      if (next.has(userEmail)) next.delete(userEmail);
      else next.add(userEmail);
      return next;
    });
  }

  // Auto-save on status change
  const updateStatus = useCallback(
    async (userEmail: string, newStatus: string) => {
      setSaving(userEmail);
      try {
        const res = await fetch(
          `/api/activities/${activityId}/registrations`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userEmail, status: newStatus }),
          }
        );
        if (!res.ok) throw new Error("Failed to update");

        setRegistrations((prev) =>
          prev.map((r) =>
            r.userEmail === userEmail ? { ...r, status: newStatus } : r
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

  // Flag a user (yellow or red)
  const flagUser = useCallback(
    async (userEmail: string, flagType: "yellow" | "red") => {
      setFlagging(userEmail);
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(userEmail)}/flag`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ flagType, activityId }),
        });
        if (!res.ok) throw new Error("Failed to flag");
        toast.success(
          `${flagType === "yellow" ? "Yellow" : "Red"} flag applied`
        );
      } catch {
        toast.error("Failed to flag user");
      } finally {
        setFlagging(null);
      }
    },
    [activityId]
  );

  const deregister = useCallback(
    async (userEmail: string) => {
      try {
        const res = await fetch(
          `/api/activities/${activityId}/registrations`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userEmail }),
          }
        );
        if (!res.ok) throw new Error("Failed");
        setRegistrations((prev) =>
          prev.filter((r) => r.userEmail !== userEmail)
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
          key={reg.userEmail}
          className={`${saving === reg.userEmail ? "opacity-60" : ""}`}
        >
          <CardContent className="pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{reg.userName}</span>
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
                  {reg.userEmailDisplay}
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
                {reg.formData && Object.values(reg.formData).some((v) => v !== undefined && v !== "" && v !== false) && (
                  <div className="mt-2">
                    <button
                      type="button"
                      className="text-xs text-green-700 hover:underline"
                      onClick={() => toggleFormData(reg.userEmail)}
                    >
                      {expandedFormData.has(reg.userEmail) ? "Hide details" : "Show details"}
                    </button>
                    {expandedFormData.has(reg.userEmail) && (
                      <div className="mt-2 p-3 bg-gray-50 rounded text-sm space-y-1">
                        {reg.formData.expectations && (
                          <div><span className="text-muted-foreground">Expectations: </span>{reg.formData.expectations}</div>
                        )}
                        {reg.formData.dietaryRestrictions && (
                          <div><span className="text-muted-foreground">Dietary: </span>{reg.formData.dietaryRestrictions}</div>
                        )}
                        {reg.formData.bringItems && (
                          <div><span className="text-muted-foreground">Bringing: </span>{reg.formData.bringItems}</div>
                        )}
                        {reg.formData.isCrazyHikerMember && (
                          <div><span className="text-muted-foreground">Member: </span>{reg.formData.isCrazyHikerMember}</div>
                        )}
                        {reg.formData.fitnessStatement && (
                          <div><span className="text-muted-foreground">Fitness: </span>{reg.formData.fitnessStatement}</div>
                        )}
                        {reg.formData.confirmRules && (
                          <div><span className="text-muted-foreground">Rules confirmed: </span>Yes</div>
                        )}
                        {reg.formData.confirmInfo && (
                          <div><span className="text-muted-foreground">Info confirmed: </span>Yes</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isEditable && (
                <div className="flex flex-col gap-2 items-end flex-shrink-0">
                  {/* Status change dropdown — auto-saves */}
                  <Select
                    value={reg.status}
                    onValueChange={(val) => val && updateStatus(reg.userEmail, val)}
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
                      onClick={() => flagUser(reg.userEmail, "yellow")}
                      disabled={flagging === reg.userEmail}
                    >
                      ⚠ Yellow
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50"
                      onClick={() => flagUser(reg.userEmail, "red")}
                      disabled={flagging === reg.userEmail}
                    >
                      🚫 Red
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => deregister(reg.userEmail)}
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
