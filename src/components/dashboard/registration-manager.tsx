"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Loader2Icon, CheckIcon, ClockIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRegistrationsStore } from "./registrations-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export type RegistrationFormData = {
  transportTicket?: string;
  departureCity?: string;
  cameraEquipment?: string[];
  willPostSocialMedia?: boolean;
  willingToBePhotographed?: boolean;
  confirmInfo?: boolean;
};

export type Registration = {
  userEmail: string;
  userUid: string;
  userName: string;
  userEmailDisplay: string;
  status: string;
  registeredAt: string;
  confirmedAt: string | null;
  notes: string | null;
  formData?: RegistrationFormData | null;
  userProfile?: Record<string, unknown> | null;
  totalAttended: number;
  hasValidWaiver: boolean;
  waiverSignedName: string | null;
  yellowFlags: number;
  redFlags: number;
  flagHistory: {
    flagType: string;
    reason: string | null;
    activityDate: string;
    activityTitle: string;
    issuerName: string;
  }[];
  isBanned: boolean;
  pendingFlag: string | null;
  pendingFlagReason: string | null;
  proposalCount: number;
  viewerProposed: boolean;
  activityHistory: {
    activityId: string;
    activityTitle: string;
    activityDate: string;
    status: string;
  }[];
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

function FlagButton({
  flagType,
  userName,
  disabled,
  onSubmit,
}: {
  flagType: "yellow" | "red";
  userName: string;
  disabled: boolean;
  onSubmit: (reason: string) => void;
}) {
  const t = useTranslations("dashboard.activities");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const isYellow = flagType === "yellow";

  function handleSubmit() {
    if (!reason.trim()) return;
    onSubmit(reason.trim());
    setOpen(false);
    setReason("");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setReason(""); }}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={`h-7 text-xs ${
              isYellow
                ? "text-yellow-600 border-yellow-300 hover:bg-yellow-50"
                : "text-red-600 border-red-300 hover:bg-red-50"
            }`}
            disabled={disabled}
          />
        }
      >
        {isYellow ? "⚠ Yellow" : "🚫 Red"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("flagDialogTitle", { type: flagType, name: userName })}
          </DialogTitle>
          <DialogDescription>
            {t("flagDialogDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="flag-reason">{t("flagReasonLabel")}</Label>
          <Textarea
            id="flag-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("flagReasonPlaceholder")}
            rows={3}
          />
          <p className="text-xs text-orange-600">{t("flagAuditWarning")}</p>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("cancelAction")}
          </DialogClose>
          <Button
            className={isYellow ? "bg-yellow-600 hover:bg-yellow-700" : "bg-red-600 hover:bg-red-700"}
            onClick={handleSubmit}
            disabled={!reason.trim()}
          >
            {t("confirmFlag")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Debounce window for attendance auto-save. All pending modifications
// accumulate in a single buffer and flush together in one network request
// after the manager has been idle for this long. Flush on unmount /
// beforeunload so no changes are lost.
const AUTO_SAVE_DELAY_MS = 5000;

export function RegistrationManager({
  activityId,
  activityStatus,
  canViewMemberDetail,
  capacity,
  viewerIsIntern = false,
}: {
  activityId: string;
  activityStatus: string;
  canViewMemberDetail: boolean;
  capacity: number;
  viewerIsIntern?: boolean;
}) {
  const t = useTranslations("dashboard.activities");
  const tp = useTranslations("dashboard.myProfile");
  const ta = useTranslations("activity");
  const locale = useLocale();
  const router = useRouter();
  const { registrations, setRegistrations } = useRegistrationsStore();
  const [saving, setSaving] = useState<string | null>(null);
  const [proposing, setProposing] = useState<string | null>(null);
  const [flagging, setFlagging] = useState<string | null>(null);
  const [expandedFormData, setExpandedFormData] = useState<Set<string>>(new Set());
  // 'idle' = nothing ever saved or pending in this session
  // 'pending' = changes buffered or in-flight (not yet confirmed by server)
  // 'saved' = most recent batch confirmed by server; sticks until next change
  const [saveState, setSaveState] = useState<"idle" | "pending" | "saved">("idle");
  const [finishOpen, setFinishOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [activityActionProcessing, setActivityActionProcessing] = useState(false);

  // Global buffer of pending attendance changes (keyed by userEmail, value
  // = desired status). A single debounce timer flushes the whole buffer in
  // one batch request.
  const pendingChangesRef = useRef<Map<string, string>>(new Map());
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const confirmedCount = registrations.filter((r) =>
    ["registration_confirmed", "attended"].includes(r.status)
  ).length;
  const isAtCapacity = capacity > 0 && confirmedCount >= capacity;

  function toggleFormData(userEmail: string) {
    setExpandedFormData((prev) => {
      const next = new Set(prev);
      if (next.has(userEmail)) next.delete(userEmail);
      else next.add(userEmail);
      return next;
    });
  }

  // Send a batch of attendance updates in a single request. Used by both
  // the debounced flush and the Finish/Cancel pre-action flush. Attendance
  // transitions (`attended` / `absent`) have no server-side side effects,
  // so the server just does a transactional updateMany.
  const sendBatch = useCallback(
    async (entries: [string, string][]) => {
      if (entries.length === 0) return;
      const res = await fetch(`/api/activities/${activityId}/registrations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: entries.map(([userEmail, status]) => ({ userEmail, status })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update");
      }
    },
    [activityId]
  );

  // Immediate save — used by the "Confirm Registration" button. Has
  // capacity/email side effects, so it stays network-first (not batched).
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
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update");
        }
        setRegistrations((prev) =>
          prev.map((r) =>
            r.userEmail === userEmail ? { ...r, status: newStatus } : r
          )
        );
        toast.success(`${statusLabels[newStatus]}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update");
      } finally {
        setSaving(null);
      }
    },
    [activityId]
  );

  // Intern action: propose / withdraw proposal on a pending member.
  // Optimistic — we flip viewerProposed and bump proposalCount immediately
  // and roll back if the request fails.
  const toggleProposal = useCallback(
    async (userEmail: string, currentlyProposed: boolean) => {
      setProposing(userEmail);
      const delta = currentlyProposed ? -1 : 1;
      setRegistrations((prev) =>
        prev.map((r) =>
          r.userEmail === userEmail
            ? { ...r, viewerProposed: !currentlyProposed, proposalCount: r.proposalCount + delta }
            : r
        )
      );
      try {
        const res = await fetch(
          `/api/activities/${activityId}/registrations/${encodeURIComponent(userEmail)}/proposal`,
          { method: currentlyProposed ? "DELETE" : "POST" }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update proposal");
        }
      } catch (err) {
        // Roll back the optimistic update
        setRegistrations((prev) =>
          prev.map((r) =>
            r.userEmail === userEmail
              ? { ...r, viewerProposed: currentlyProposed, proposalCount: r.proposalCount - delta }
              : r
          )
        );
        toast.error(err instanceof Error ? err.message : "Failed to update proposal");
      } finally {
        setProposing(null);
      }
    },
    [activityId, setRegistrations]
  );

  // Drain whatever is currently in the pending buffer and send it as a
  // single batch. On success, transition to 'saved' only if the buffer is
  // still empty (i.e. the user didn't queue new changes while the request
  // was in flight). On failure, re-queue the dropped entries (without
  // clobbering any newer user choice) so they get retried on the next
  // flush cycle.
  const drainAndSend = useCallback(async () => {
    const entries = [...pendingChangesRef.current.entries()];
    pendingChangesRef.current.clear();
    if (entries.length === 0) return;
    try {
      await sendBatch(entries);
      if (pendingChangesRef.current.size === 0 && !pendingTimerRef.current) {
        setSaveState("saved");
      }
    } catch (err) {
      for (const [email, status] of entries) {
        if (!pendingChangesRef.current.has(email)) {
          pendingChangesRef.current.set(email, status);
        }
      }
      toast.error(err instanceof Error ? err.message : "Failed to update");
      // Stay in 'pending' — the user knows from the toast and the indicator
      // that the save did not complete.
    }
  }, [sendBatch]);

  // Debounced save — buffers every attendance toggle in a global map and
  // fires one batch request once the manager has been idle for
  // AUTO_SAVE_DELAY_MS. Optimistic UI is immediate.
  const scheduleAttendanceSave = useCallback(
    (userEmail: string, newStatus: string) => {
      setRegistrations((prev) =>
        prev.map((r) =>
          r.userEmail === userEmail ? { ...r, status: newStatus } : r
        )
      );
      pendingChangesRef.current.set(userEmail, newStatus);
      setSaveState("pending");

      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = setTimeout(() => {
        pendingTimerRef.current = null;
        void drainAndSend();
      }, AUTO_SAVE_DELAY_MS);
    },
    [drainAndSend]
  );

  // Synchronous flush for explicit actions (Finish / Cancel). Awaitable.
  // Cancels the pending timer and immediately drains the buffer.
  const flushPendingSaves = useCallback(async () => {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    await drainAndSend();
  }, [drainAndSend]);

  // Fire-and-forget flush for tab close / hard reloads. `keepalive: true`
  // lets the request finish even after the document is torn down.
  const flushPendingSavesBeacon = useCallback(() => {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    const entries = [...pendingChangesRef.current.entries()];
    if (entries.length === 0) return;
    pendingChangesRef.current.clear();
    fetch(`/api/activities/${activityId}/registrations`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updates: entries.map(([userEmail, status]) => ({ userEmail, status })),
      }),
      keepalive: true,
    }).catch(() => {});
  }, [activityId]);

  useEffect(() => {
    const handler = () => flushPendingSavesBeacon();
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      flushPendingSavesBeacon();
    };
  }, [flushPendingSavesBeacon]);

  // Set or clear a pending flag on a registration
  const flagUser = useCallback(
    async (userEmail: string, flagType: "yellow" | "red", reason: string) => {
      setFlagging(userEmail);
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(userEmail)}/flag`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ flagType, activityId, reason }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed");
        }
        setRegistrations((prev) =>
          prev.map((r) =>
            r.userEmail === userEmail
              ? { ...r, pendingFlag: data.pendingFlag, pendingFlagReason: data.pendingFlagReason }
              : r
          )
        );
        toast.success(
          data.pendingFlag
            ? t("flagPending", { type: data.pendingFlag })
            : t("flagCleared")
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to flag user");
      } finally {
        setFlagging(null);
      }
    },
    [activityId, t]
  );

  // Clear a pending flag
  const clearFlag = useCallback(
    async (userEmail: string) => {
      setFlagging(userEmail);
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(userEmail)}/flag`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activityId }),
        });
        if (!res.ok) throw new Error("Failed");
        setRegistrations((prev) =>
          prev.map((r) =>
            r.userEmail === userEmail
              ? { ...r, pendingFlag: null, pendingFlagReason: null }
              : r
          )
        );
        toast.success(t("flagCleared"));
      } catch {
        toast.error("Failed to clear flag");
      } finally {
        setFlagging(null);
      }
    },
    [activityId, t]
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

  const [bulkRemoveOpen, setBulkRemoveOpen] = useState(false);
  const [bulkRemoving, setBulkRemoving] = useState(false);
  const unconfirmedCount = registrations.filter((r) => r.status === "registered").length;

  // Finish / Cancel the activity. Flushes all pending attendance saves first
  // so debounced "attended" marks don't get overwritten back to "absent" by
  // the server-side finish transaction.
  const runActivityAction = useCallback(
    async (newStatus: "completed" | "cancelled") => {
      setActivityActionProcessing(true);
      try {
        await flushPendingSaves();
        const res = await fetch(`/api/activities/${activityId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) throw new Error("Failed");
        toast.success(
          newStatus === "completed" ? t("activityFinished") : t("activityCancelled")
        );
        router.refresh();
      } catch {
        toast.error("Failed");
      } finally {
        setActivityActionProcessing(false);
        setFinishOpen(false);
        setCancelOpen(false);
      }
    },
    [activityId, flushPendingSaves, router, t]
  );

  const removeAllUnconfirmed = useCallback(async () => {
    setBulkRemoving(true);
    try {
      const res = await fetch(`/api/activities/${activityId}/registrations`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: "unconfirmed" }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setRegistrations((prev) => prev.filter((r) => r.status !== "registered"));
      toast.success(t("removedUnconfirmed", { count: data.removed ?? 0 }));
      setBulkRemoveOpen(false);
    } catch {
      toast.error("Failed");
    } finally {
      setBulkRemoving(false);
    }
  }, [activityId, t]);

  const isEditable = activityStatus === "open";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{t("registrationsTitle")}</CardTitle>
          {isEditable && (
            <div className="flex gap-2 flex-wrap">
              <Dialog open={finishOpen} onOpenChange={setFinishOpen}>
                <DialogTrigger
                  render={
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      disabled={confirmedCount === 0}
                    />
                  }
                >
                  {t("finishActivity")}
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("finishConfirmTitle")}</DialogTitle>
                    <DialogDescription>
                      {t("finishConfirmDescription")}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose render={<Button variant="outline" />}>
                      {t("cancelAction")}
                    </DialogClose>
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => runActivityAction("completed")}
                      disabled={activityActionProcessing}
                    >
                      {activityActionProcessing ? "..." : t("confirmFinish")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <DialogTrigger
                  render={<Button variant="destructive" size="sm" />}
                >
                  {t("cancelActivity")}
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("cancelConfirmTitle")}</DialogTitle>
                    <DialogDescription>
                      {t("cancelConfirmDescription")}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose render={<Button variant="outline" />}>
                      {t("cancelAction")}
                    </DialogClose>
                    <Button
                      variant="destructive"
                      onClick={() => runActivityAction("cancelled")}
                      disabled={activityActionProcessing}
                    >
                      {activityActionProcessing ? "..." : t("confirmCancel")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-1">
          <span>
            {t("registrationCount", { count: registrations.length })}
            {capacity > 0 && ` · ${confirmedCount} / ${capacity} ${t("confirmed")}`}
            {isAtCapacity && (
              <span className="text-orange-600 font-medium"> · {t("capacityReached")}</span>
            )}
            {" · "}{t("autoSaveHint")}
          </span>
          {saveState === "pending" && (
            <span className="inline-flex items-center gap-1 text-gray-400">
              <Loader2Icon className="size-3 animate-spin" />
              {t("pendingSave")}
            </span>
          )}
          {saveState === "saved" && (
            <span className="inline-flex items-center gap-1 text-gray-400">
              <CheckIcon className="size-3" />
              {t("savedAutomatically")}
            </span>
          )}
        </div>
        {isEditable && (
          <Dialog open={bulkRemoveOpen} onOpenChange={setBulkRemoveOpen}>
            <DialogTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  disabled={unconfirmedCount === 0 || bulkRemoving}
                />
              }
            >
              {t("removeUnconfirmed")}
              {unconfirmedCount > 0 ? ` (${unconfirmedCount})` : ""}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("removeUnconfirmedConfirmTitle")}</DialogTitle>
                <DialogDescription>
                  {t("removeUnconfirmedConfirmDescription", { count: unconfirmedCount })}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  {t("cancelAction")}
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={removeAllUnconfirmed}
                  disabled={bulkRemoving}
                >
                  {bulkRemoving ? "..." : t("removeUnconfirmed")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {registrations.map((reg) => (
        <Card
          key={reg.userEmail}
          className={`${saving === reg.userEmail ? "opacity-60" : ""} ${canViewMemberDetail ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
          onClick={canViewMemberDetail ? () => router.push(`/dashboard/members/${reg.userUid}`) : undefined}
        >
          <CardContent className="pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{reg.userName}</span>
                  {reg.proposalCount > 0 && (
                    <span
                      className="inline-flex items-center text-amber-600"
                      title={
                        reg.proposalCount === 1
                          ? t("proposedByIntern")
                          : t("proposedByInternCount", { count: reg.proposalCount })
                      }
                    >
                      <ClockIcon className="h-4 w-4" />
                    </span>
                  )}
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
                  {new Date(reg.registeredAt).toLocaleDateString(locale)}
                </div>
                {reg.notes && (
                  <div className="text-sm mt-2 p-2 bg-gray-50 rounded text-gray-600">
                    {reg.notes}
                  </div>
                )}
                {reg.pendingFlag && reg.pendingFlagReason && (
                  <div className={`text-sm mt-2 p-2 rounded ${
                    reg.pendingFlag === "yellow"
                      ? "bg-yellow-50 border border-yellow-200 text-yellow-800"
                      : "bg-red-50 border border-red-200 text-red-800"
                  }`}>
                    <span className="font-medium">
                      {reg.pendingFlag === "yellow" ? "⚠" : "🚫"} {activityStatus === "completed" ? t("flagLabel") : t("pendingFlagLabel")}:
                    </span>{" "}
                    {reg.pendingFlagReason}
                  </div>
                )}
                {(reg.formData || reg.userProfile || reg.flagHistory.length > 0 || reg.activityHistory.length > 0) && (
                  <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="text-xs text-green-700 hover:underline"
                      onClick={() => toggleFormData(reg.userEmail)}
                    >
                      {expandedFormData.has(reg.userEmail) ? t("hideDetails") : t("showDetails")}
                    </button>
                    {expandedFormData.has(reg.userEmail) && (
                      <div className="mt-2 space-y-3">
                        {/* User profile summary */}
                        {reg.userProfile && (
                          <div className="p-3 bg-blue-50 rounded text-sm space-y-1">
                            <div className="font-medium text-blue-800 text-xs mb-2">{tp("personalDetails")}</div>
                            {(() => {
                              const p = reg.userProfile;
                              const fields: [string, string][] = [
                                ["gender", tp("gender")],
                                ["organization", tp("organization")],
                                ["fiveKmPace", tp("fiveKmPace")],
                                ["maxElevationGain", tp("maxElevationGain")],
                                ["maxElevationLoss", tp("maxElevationLoss")],
                                ["emergencyContact", tp("emergencyContact")],
                                ["emergencyPhone", tp("emergencyPhone")],
                                ["navigationSoftware", tp("navigationSoftware")],
                                ["selfIntro", tp("selfIntro")],
                              ];
                              const arrayFields: [string, string][] = [
                                ["fitnessActivities", tp("fitnessActivities")],
                                ["equipment", tp("equipment")],
                                ["insurance", tp("insurance")],
                              ];
                              const translateOption = (key: string) => {
                                const translated = tp.has(`options.${key}`) ? tp(`options.${key}`) : key;
                                return translated;
                              };
                              return (
                                <>
                                  {fields.map(([k, label]) => {
                                    const v = p[k];
                                    if (!v) return null;
                                    const display = k === "gender" ? translateOption(String(v)) : String(v);
                                    return <div key={k}><span className="text-muted-foreground">{label}: </span>{display}</div>;
                                  })}
                                  {arrayFields.map(([k, label]) => {
                                    const v = p[k];
                                    if (!Array.isArray(v) || v.length === 0) return null;
                                    return <div key={k}><span className="text-muted-foreground">{label}: </span>{v.map(translateOption).join(", ")}</div>;
                                  })}
                                </>
                              );
                            })()}
                          </div>
                        )}
                        {/* Waiver signed name */}
                        <div className="p-3 bg-purple-50 rounded text-sm">
                          <div className="font-medium text-purple-800 text-xs mb-2">{t("waiverInfo")}</div>
                          {reg.waiverSignedName ? (
                            <div><span className="text-muted-foreground">{t("waiverSignedName")}: </span>{reg.waiverSignedName}</div>
                          ) : (
                            <div className="text-red-600">{t("noWaiver")}</div>
                          )}
                        </div>
                        {/* Per-registration form data */}
                        {reg.formData && (
                          <div className="p-3 bg-gray-50 rounded text-sm space-y-1">
                            <div className="font-medium text-gray-600 text-xs mb-2">{ta("additionalInfo")}</div>
                            {reg.formData.transportTicket && (
                              <div><span className="text-muted-foreground">{ta("transportTicket")}: </span>{reg.formData.transportTicket}</div>
                            )}
                            {reg.formData.departureCity && (
                              <div><span className="text-muted-foreground">{ta("departureCity")}: </span>{reg.formData.departureCity}</div>
                            )}
                            {reg.formData.cameraEquipment && reg.formData.cameraEquipment.length > 0 && (
                              <div><span className="text-muted-foreground">{ta("cameraEquipment")}: </span>{reg.formData.cameraEquipment.map((v: string) => ta.has(`options.${v}`) ? ta(`options.${v}`) : v).join(", ")}</div>
                            )}
                            {reg.formData.willPostSocialMedia !== undefined && (
                              <div><span className="text-muted-foreground">{ta("willPostSocialMedia")}: </span>{reg.formData.willPostSocialMedia ? ta("yes") : ta("no")}</div>
                            )}
                            {reg.formData.willingToBePhotographed !== undefined && (
                              <div><span className="text-muted-foreground">{ta("willingToBePhotographed")}: </span>{reg.formData.willingToBePhotographed ? ta("willing") : ta("notWilling")}</div>
                            )}
                          </div>
                        )}
                        {/* Flag history */}
                        {reg.flagHistory.length > 0 && (
                          <div className="space-y-2">
                            {reg.flagHistory.map((flag, i) => (
                              <div key={i} className={`p-3 rounded text-sm space-y-1 ${
                                flag.flagType === "yellow"
                                  ? "bg-yellow-50 border border-yellow-200"
                                  : "bg-red-50 border border-red-200"
                              }`}>
                                <div className="flex items-center gap-2">
                                  <Badge className={`text-xs ${
                                    flag.flagType === "yellow"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-red-100 text-red-800"
                                  }`}>
                                    {flag.flagType}
                                  </Badge>
                                  <span className="text-muted-foreground">
                                    {tp("from")} {flag.activityTitle}
                                  </span>
                                </div>
                                <div className="text-muted-foreground">
                                  {tp("issuedBy")} {flag.issuerName} {tp("on")} {new Date(flag.activityDate).toLocaleDateString(locale)}
                                </div>
                                {flag.reason && (
                                  <div>{tp("reason")}: {flag.reason}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Activity history */}
                        {reg.activityHistory.length > 0 && (
                          <div className="p-3 bg-green-50 rounded text-sm space-y-1">
                            <div className="font-medium text-green-800 text-xs mb-2">{t("activityHistoryLabel")}</div>
                            {reg.activityHistory.map((ah) => (
                              <div key={ah.activityId} className="flex items-center justify-between gap-2">
                                <Link
                                  href={`/dashboard/activity-view/${ah.activityId}`}
                                  className="text-green-700 hover:underline truncate"
                                >
                                  {ah.activityTitle}
                                </Link>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-muted-foreground text-xs">
                                    {new Date(ah.activityDate).toLocaleDateString(locale)}
                                  </span>
                                  <Badge className={statusColors[ah.status] || "bg-gray-100 text-gray-800"}>
                                    {statusLabels[ah.status] || ah.status}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isEditable && (
                <div className="flex flex-col gap-2 items-end flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  {/* Status controls */}
                  {reg.status === "registered" ? (
                    <div className="flex flex-col items-end gap-1">
                      {viewerIsIntern ? (
                        <Button
                          size="sm"
                          variant={reg.viewerProposed ? "outline" : "default"}
                          className={`h-8 text-xs ${
                            reg.viewerProposed
                              ? "border-amber-400 text-amber-700 hover:bg-amber-50"
                              : "bg-amber-500 hover:bg-amber-600 text-white"
                          }`}
                          onClick={() => toggleProposal(reg.userEmail, reg.viewerProposed)}
                          disabled={proposing === reg.userEmail}
                        >
                          {proposing === reg.userEmail
                            ? "..."
                            : reg.viewerProposed
                              ? t("withdrawProposalAction")
                              : t("proposeAction")}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-green-600 hover:bg-green-700"
                          onClick={() => updateStatus(reg.userEmail, "registration_confirmed")}
                          disabled={saving === reg.userEmail || isAtCapacity}
                        >
                          {saving === reg.userEmail ? "..." : t("confirmRegistration")}
                        </Button>
                      )}
                      {!viewerIsIntern && isAtCapacity && (
                        <span className="text-xs text-orange-600">{t("capacityReached")}</span>
                      )}
                    </div>
                  ) : (
                    <Select
                      value={["attended", "absent"].includes(reg.status) ? reg.status : ""}
                      onValueChange={(val) => val && scheduleAttendanceSave(reg.userEmail, val)}
                    >
                      <SelectTrigger className="w-36 h-8 text-xs">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="attended">Attended</SelectItem>
                        <SelectItem value="absent">Absent</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {/* Flag buttons — only after confirmation (attended/absent) */}
                  <div className="flex gap-1">
                    {["attended", "absent"].includes(reg.status) && (
                      <>
                        {reg.pendingFlag ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className={`h-7 text-xs ${
                              reg.pendingFlag === "yellow"
                                ? "bg-yellow-200 text-yellow-800 border-yellow-400"
                                : "bg-red-200 text-red-800 border-red-400"
                            }`}
                            onClick={() => clearFlag(reg.userEmail)}
                            disabled={flagging === reg.userEmail}
                          >
                            {reg.pendingFlag === "yellow" ? "⚠ Yellow" : "🚫 Red"} ✕
                          </Button>
                        ) : (
                          <>
                            <FlagButton
                              flagType="yellow"
                              userName={reg.userName}
                              disabled={flagging === reg.userEmail}
                              onSubmit={(reason) => flagUser(reg.userEmail, "yellow", reason)}
                            />
                            <FlagButton
                              flagType="red"
                              userName={reg.userName}
                              disabled={flagging === reg.userEmail}
                              onSubmit={(reason) => flagUser(reg.userEmail, "red", reason)}
                            />
                          </>
                        )}
                      </>
                    )}
                    <Dialog>
                      <DialogTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground"
                          />
                        }
                      >
                        ✕
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t("deregisterConfirmTitle")}</DialogTitle>
                          <DialogDescription>
                            {t("deregisterConfirmDescription", { name: reg.userName })}
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <DialogClose render={<Button variant="outline" />}>
                            {t("cancelAction")}
                          </DialogClose>
                          <Button
                            variant="destructive"
                            onClick={() => deregister(reg.userEmail)}
                          >
                            {t("confirmDeregister")}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {registrations.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {t("noRegistrations")}
        </div>
      )}
      </CardContent>
    </Card>
  );
}
