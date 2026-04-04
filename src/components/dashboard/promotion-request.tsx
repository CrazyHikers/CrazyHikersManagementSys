"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Referral = {
  email: string;
  name: string;
};

type PendingVote = {
  id: string;
  voterEmail: string;
  approved: boolean | null;
  votedAt: string | null;
};

type PendingRequest = {
  id: string;
  type: string;
  status: string;
  requestedAt: string;
  expiresAt: string;
  votes: PendingVote[];
};

type PromotionEligibility = {
  role: string;
  isIntern: boolean;
  attendedCount: number;
  distinctManagerCount: number;
  hasActiveFlag: boolean;
  managedCount: number;
  comanagedCount: number;
  pendingRequest: PendingRequest | null;
  availableReferrals: Referral[];
};

export function PromotionRequest({
  eligibility,
}: {
  eligibility: PromotionEligibility;
}) {
  const [selectedReferrals, setSelectedReferrals] = useState<string[]>([]);
  const [applicationText, setApplicationText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const {
    role,
    isIntern,
    attendedCount,
    distinctManagerCount,
    hasActiveFlag,
    managedCount,
    comanagedCount,
    pendingRequest,
    availableReferrals,
  } = eligibility;

  // Determine what kind of promotion is possible
  const isMember = role === "member";
  const isInternManager = role === "manager" && isIntern;

  // No promotion possible for qualified managers or admins
  if (!isMember && !isInternManager) {
    return null;
  }

  // Show pending request status
  if (pendingRequest) {
    const castVotes = pendingRequest.votes.filter(
      (v) => v.approved !== null
    );
    const approvedVotes = castVotes.filter((v) => v.approved);

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Promotion Request</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="font-medium">Status:</span>
            <Badge
              className={
                pendingRequest.status === "pending"
                  ? "bg-yellow-100 text-yellow-800"
                  : pendingRequest.status === "pending_admin_review"
                    ? "bg-blue-100 text-blue-800"
                    : pendingRequest.status === "approved"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
              }
            >
              {pendingRequest.status === "pending_admin_review"
                ? "Awaiting Admin Review"
                : pendingRequest.status}
            </Badge>
          </div>
          <div>
            <span className="font-medium">Type:</span>{" "}
            {pendingRequest.type === "member_to_intern"
              ? "Member to Intern Manager"
              : "Intern to Qualified Manager"}
          </div>
          <div>
            <span className="font-medium">Expires:</span>{" "}
            {new Date(pendingRequest.expiresAt).toLocaleString()}
          </div>
          <div>
            <span className="font-medium">Vote progress:</span>{" "}
            {castVotes.length} / {pendingRequest.votes.length} voted
            {castVotes.length > 0 && (
              <span className="text-muted-foreground">
                {" "}
                ({approvedVotes.length} approved)
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Member -> Intern Manager eligibility
  if (isMember) {
    const eligible =
      attendedCount >= 3 && distinctManagerCount >= 2 && !hasActiveFlag;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Promotion to Intern Manager
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span>{attendedCount >= 3 ? "+" : "-"}</span>
              <span>
                Activities attended: {attendedCount} / 3 required
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>{distinctManagerCount >= 2 ? "+" : "-"}</span>
              <span>
                Different main managers: {distinctManagerCount} / 2 required
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>{!hasActiveFlag ? "+" : "-"}</span>
              <span>
                {hasActiveFlag
                  ? "Active flag on account"
                  : "No active flags"}
              </span>
            </div>
          </div>

          {eligible && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Select 2 non-intern managers as referrals:
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {availableReferrals.map((ref) => (
                  <label
                    key={ref.email}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedReferrals.includes(ref.email)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          if (selectedReferrals.length < 2) {
                            setSelectedReferrals([
                              ...selectedReferrals,
                              ref.email,
                            ]);
                          }
                        } else {
                          setSelectedReferrals(
                            selectedReferrals.filter(
                              (email) => email !== ref.email
                            )
                          );
                        }
                      }}
                      disabled={
                        !selectedReferrals.includes(ref.email) &&
                        selectedReferrals.length >= 2
                      }
                    />
                    {ref.name} ({ref.email})
                  </label>
                ))}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Application text (optional)
                </label>
                <Textarea
                  placeholder="Tell us why you want to become an intern manager..."
                  value={applicationText}
                  onChange={(e) => setApplicationText(e.target.value)}
                  rows={3}
                />
              </div>
              <Button
                className="bg-green-600 hover:bg-green-700"
                disabled={selectedReferrals.length !== 2 || submitting}
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    const res = await fetch("/api/promotions", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        referralEmails: selectedReferrals,
                        applicationText: applicationText || undefined,
                      }),
                    });
                    if (!res.ok) {
                      const err = await res.json();
                      toast.error(err.error || "Failed to submit request");
                      return;
                    }
                    toast.success(
                      "Promotion request submitted! Your referrals will be notified."
                    );
                    window.location.reload();
                  } catch {
                    toast.error("Failed to submit request");
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                {submitting ? "Submitting..." : "Request Promotion"}
              </Button>
            </div>
          )}

          {!eligible && (
            <p className="text-sm text-muted-foreground">
              You do not yet meet the eligibility requirements for promotion.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Intern Manager -> Qualified Manager eligibility
  if (isInternManager) {
    const eligible = managedCount >= 2 && comanagedCount >= 2;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Promotion to Qualified Manager
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span>{managedCount >= 2 ? "+" : "-"}</span>
              <span>
                Completed activities managed: {managedCount} / 2 required
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>{comanagedCount >= 2 ? "+" : "-"}</span>
              <span>
                Completed activities co-managed: {comanagedCount} / 2
                required
              </span>
            </div>
          </div>

          {eligible && (
            <Button
              className="bg-green-600 hover:bg-green-700"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                try {
                  const res = await fetch("/api/promotions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({}),
                  });
                  if (!res.ok) {
                    const err = await res.json();
                    toast.error(err.error || "Failed to submit request");
                    return;
                  }
                  toast.success(
                    "Promotion request submitted! All qualified managers will be notified to vote."
                  );
                  window.location.reload();
                } catch {
                  toast.error("Failed to submit request");
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {submitting ? "Submitting..." : "Request Promotion"}
            </Button>
          )}

          {!eligible && (
            <p className="text-sm text-muted-foreground">
              You do not yet meet the eligibility requirements for promotion.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
}
