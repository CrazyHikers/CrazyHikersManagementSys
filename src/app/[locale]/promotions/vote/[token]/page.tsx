"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale } from "next-intl";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type VoteData = {
  vote: {
    id: string;
    voterEmail: string;
    request: {
      id: string;
      type: string;
      expiresAt: string;
      user: { email: string; name: string };
      votes: { id: string; approved: boolean | null }[];
    };
  };
  stats: {
    attendedCount: number;
    managedCount: number;
    comanagedCount: number;
  };
  alreadyVoted?: boolean;
  expired?: boolean;
};

export default function VotePage() {
  const params = useParams();
  const locale = useLocale();
  const token = params.token as string;

  const [data, setData] = useState<VoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchVote() {
      try {
        const res = await fetch(`/api/promotions/vote/${token}`);
        if (!res.ok) {
          setError("Vote not found");
          return;
        }
        const json = await res.json();
        setData(json);
      } catch {
        setError("Failed to load vote details");
      } finally {
        setLoading(false);
      }
    }
    fetchVote();
  }, [token]);

  async function handleVote(approved: boolean) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/promotions/vote/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved, reason: reason || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Failed to submit vote");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Failed to submit vote");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
    <div className="min-h-screen bg-gray-50 flex-1">
      <SiteHeader />
      <div className="container mx-auto max-w-lg px-4 py-12">
        {loading && (
          <div className="text-center py-12 text-muted-foreground">
            Loading...
          </div>
        )}

        {error && (
          <Card>
            <CardContent className="py-12 text-center text-red-600">
              {error}
            </CardContent>
          </Card>
        )}

        {!loading && !error && data?.alreadyVoted && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              You have already voted on this request.
            </CardContent>
          </Card>
        )}

        {!loading && !error && data?.expired && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              This voting link has expired.
            </CardContent>
          </Card>
        )}

        {submitted && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-lg font-semibold text-green-700">
                Your vote has been recorded. Thank you!
              </p>
            </CardContent>
          </Card>
        )}

        {!loading &&
          !error &&
          !submitted &&
          data?.vote &&
          !data.alreadyVoted &&
          !data.expired && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {data.vote.request.type === "member_to_intern"
                    ? "Manager Referral Request"
                    : "Promotion Vote"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <p>
                    <span className="font-medium">Requester:</span>{" "}
                    {data.vote.request.user.name} ({data.vote.request.user.email}
                    )
                  </p>
                  <p>
                    <span className="font-medium">Type:</span>{" "}
                    <Badge variant="outline">
                      {data.vote.request.type === "member_to_intern"
                        ? "Member to Intern Manager"
                        : "Intern to Qualified Manager"}
                    </Badge>
                  </p>
                  <p>
                    <span className="font-medium">Expires:</span>{" "}
                    {new Date(data.vote.request.expiresAt).toLocaleString(locale)}
                  </p>
                </div>

                <div className="rounded-lg bg-gray-100 p-4 space-y-1">
                  <p className="font-medium text-sm mb-2">Requester Stats</p>
                  <p className="text-sm">
                    Activities attended: {data.stats.attendedCount}
                  </p>
                  <p className="text-sm">
                    Activities managed: {data.stats.managedCount}
                  </p>
                  <p className="text-sm">
                    Activities co-managed: {data.stats.comanagedCount}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Votes cast:{" "}
                    {
                      data.vote.request.votes.filter(
                        (v) => v.approved !== null
                      ).length
                    }{" "}
                    / {data.vote.request.votes.length}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason (optional)</Label>
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Provide a reason for your decision..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => handleVote(true)}
                    disabled={submitting}
                  >
                    {submitting ? "..." : "Approve"}
                  </Button>
                  <Button
                    className="flex-1"
                    variant="destructive"
                    onClick={() => handleVote(false)}
                    disabled={submitting}
                  >
                    {submitting ? "..." : "Reject"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
      </div>
    </div>
    <SiteFooter />
    </>
  );
}
