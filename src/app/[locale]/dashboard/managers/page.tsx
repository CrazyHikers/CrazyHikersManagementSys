"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { SortableHead, MobileSortBar, type SortState } from "@/components/dashboard/sortable-head";

type Manager = {
  email: string;
  uid: string;
  name: string;
  managerProfile: {
    tag: string;
    intern: boolean;
    kpi: number;
  } | null;
};

type PendingReview = {
  id: string;
  type: string;
  userEmail: string;
  applicationText: string | null;
  requestedAt: string;
  user: { name: string; email: string };
  poll: {
    id: string;
    outcome: "passed" | "rejected" | "no_quorum" | null;
    _count: { electorate: number; participations: number };
  };
};

type ManagerSortKey = "name" | "email" | "tag" | "status" | "kpi";

export default function ManagersPage() {
  const t = useTranslations("dashboard.managers");
  const [managers, setManagers] = useState<Manager[]>([]);
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState<ManagerSortKey>>({
    key: "name",
    dir: "asc",
  });

  const sortedManagers = useMemo(() => {
    const compare = (a: Manager, b: Manager): number => {
      switch (sort.key) {
        case "name":
          return a.name.localeCompare(b.name);
        case "email":
          return a.email.localeCompare(b.email);
        case "tag":
          return (a.managerProfile?.tag ?? "").localeCompare(
            b.managerProfile?.tag ?? ""
          );
        case "status": {
          // Qualified before intern
          const rank = (m: Manager) => (m.managerProfile?.intern ? 1 : 0);
          return rank(a) - rank(b);
        }
        case "kpi":
          return (a.managerProfile?.kpi ?? 0) - (b.managerProfile?.kpi ?? 0);
      }
    };
    const copy = [...managers];
    copy.sort((a, b) => {
      const r = compare(a, b);
      return sort.dir === "asc" ? r : -r;
    });
    return copy;
  }, [managers, sort]);

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
                    Vote passed: {pr.poll._count.participations} cast / {pr.poll._count.electorate} eligible
                  </div>
                  <Link
                    href={`/dashboard/polls/${pr.poll.id}`}
                    className="text-sm font-medium text-emerald-700 hover:text-emerald-900"
                  >
                    View poll details
                  </Link>
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

      {/* Mobile sort bar */}
      <MobileSortBar
        options={[
          { key: "name", label: "Name" },
          { key: "email", label: "Email" },
          { key: "tag", label: t("tag") },
          { key: "status", label: "Status" },
          { key: "kpi", label: t("kpi") },
        ]}
        state={sort}
        onChange={setSort}
      />

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {sortedManagers.map((m) => (
          <Link key={m.email} href={`/dashboard/managers/${m.uid}`} prefetch={false}>
            <div className="bg-white rounded-lg border p-4 hover:shadow-sm transition-shadow">
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
          </Link>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead sortKey="name" state={sort} onChange={setSort}>
                Name
              </SortableHead>
              <SortableHead sortKey="email" state={sort} onChange={setSort}>
                Email
              </SortableHead>
              <SortableHead sortKey="tag" state={sort} onChange={setSort}>
                {t("tag")}
              </SortableHead>
              <SortableHead sortKey="status" state={sort} onChange={setSort}>
                Status
              </SortableHead>
              <SortableHead sortKey="kpi" state={sort} onChange={setSort}>
                {t("kpi")}
              </SortableHead>
              <TableHead>{t("currentActivities")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedManagers.map((m) => {
              const href = `/dashboard/managers/${m.uid}`;
              return (
                <TableRow key={m.email} className="cursor-pointer hover:bg-gray-50">
                  <TableCell className="p-0"><Link href={href} prefetch={false} className="block px-4 py-2 font-medium">{m.name}</Link></TableCell>
                  <TableCell className="p-0"><Link href={href} prefetch={false} className="block px-4 py-2">{m.email}</Link></TableCell>
                  <TableCell className="p-0"><Link href={href} prefetch={false} className="block px-4 py-2">{m.managerProfile?.tag || "—"}</Link></TableCell>
                  <TableCell className="p-0"><Link href={href} prefetch={false} className="block px-4 py-2">
                    <Badge className={m.managerProfile?.intern ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}>
                      {m.managerProfile?.intern ? t("intern") : t("qualified")}
                    </Badge>
                  </Link></TableCell>
                  <TableCell className="p-0"><Link href={href} prefetch={false} className="block px-4 py-2">{m.managerProfile?.kpi ?? "—"}</Link></TableCell>
                  <TableCell className="p-0"><Link href={href} prefetch={false} className="block px-4 py-2">—</Link></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
