"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

type Manager = {
  email: string;
  name: string;
  managerProfile: {
    tag: string;
    intern: boolean;
    kpi: number;
  } | null;
};

type PromotionVote = {
  id: string;
  voterEmail: string;
  approved: boolean | null;
  reason: string | null;
};

type PendingReview = {
  id: string;
  type: string;
  userEmail: string;
  applicationText: string | null;
  requestedAt: string;
  user: { name: string; email: string };
  votes: PromotionVote[];
};

export default function ManagersPage() {
  const t = useTranslations("dashboard.managers");
  const [managers, setManagers] = useState<Manager[]>([]);
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  useEffect(() => {
    fetchManagers();
    fetchPendingReviews();
  }, []);

  async function fetchManagers() {
    try {
      const res = await fetch("/api/managers");
      if (res.ok) {
        const data = await res.json();
        setManagers(data);
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchPendingReviews() {
    try {
      const res = await fetch("/api/promotions?status=pending_admin_review");
      if (res.ok) {
        const data = await res.json();
        setPendingReviews(data);
      }
    } catch {
      // ignore
    }
  }

  async function handleReview(id: string, approved: boolean, reason?: string) {
    setReviewingId(id);
    try {
      const res = await fetch(`/api/promotions/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved, reason }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to review");
      }
      toast.success(approved ? "Promotion approved" : "Promotion rejected");
      fetchPendingReviews();
      fetchManagers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setReviewingId(null);
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const tag = formData.get("tag") as string;

    try {
      const res = await fetch("/api/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, tag: tag || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create manager");
      }
      toast.success("Manager created");
      (e.target as HTMLFormElement).reset();
      fetchManagers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>

      {/* Pending Admin Reviews */}
      {pendingReviews.length > 0 && (
        <Card className="mb-6 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg">Pending Promotion Reviews</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingReviews.map((pr) => {
              const castVotes = pr.votes.filter((v) => v.approved !== null);
              const approvedVotes = castVotes.filter((v) => v.approved);
              return (
                <div
                  key={pr.id}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">
                        {pr.user.name}
                      </span>{" "}
                      <span className="text-sm text-muted-foreground">
                        ({pr.userEmail})
                      </span>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800">
                      {pr.type === "member_to_intern"
                        ? "Member to Intern"
                        : "Intern to Qualified"}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Votes: {approvedVotes.length} approved / {castVotes.length} cast / {pr.votes.length} total
                  </div>
                  {pr.applicationText && (
                    <div className="text-sm">
                      <span className="font-medium">Application:</span>{" "}
                      {pr.applicationText}
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      disabled={reviewingId === pr.id}
                      onClick={() => handleReview(pr.id, true)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={reviewingId === pr.id}
                      onClick={() => {
                        const reason = prompt("Rejection reason (optional):");
                        handleReview(pr.id, false, reason || undefined);
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Create Manager form (admin only — server protects the API) */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">{t("createManager")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="user@example.com"
                className="w-64"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tag">{t("tag")}</Label>
              <Input
                id="tag"
                name="tag"
                placeholder="Optional"
                className="w-40"
              />
            </div>
            <Button
              type="submit"
              className="bg-green-600 hover:bg-green-700"
              disabled={creating}
            >
              {creating ? "..." : t("createManager")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {managers.map((m) => (
          <div key={m.email} className="bg-white rounded-lg border p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{m.name}</div>
                <div className="text-sm text-muted-foreground">{m.email}</div>
              </div>
              <Badge
                className={
                  m.managerProfile?.intern
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-green-100 text-green-800"
                }
              >
                {m.managerProfile?.intern ? t("intern") : t("qualified")}
              </Badge>
            </div>
            <div className="flex gap-4 text-sm text-muted-foreground mt-2">
              <span>{t("tag")}: {m.managerProfile?.tag || "—"}</span>
              <span>{t("kpi")}: {m.managerProfile?.kpi ?? "—"}</span>
              <span>
                {t("currentActivities")}: —
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>{t("tag")}</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>{t("kpi")}</TableHead>
              <TableHead>{t("currentActivities")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {managers.map((m) => (
              <TableRow key={m.email}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell>{m.email}</TableCell>
                <TableCell>{m.managerProfile?.tag || "—"}</TableCell>
                <TableCell>
                  <Badge
                    className={
                      m.managerProfile?.intern
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-green-100 text-green-800"
                    }
                  >
                    {m.managerProfile?.intern ? t("intern") : t("qualified")}
                  </Badge>
                </TableCell>
                <TableCell>{m.managerProfile?.kpi ?? "—"}</TableCell>
                <TableCell>—</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
