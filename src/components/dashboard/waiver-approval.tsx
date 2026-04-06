"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type Waiver = {
  fileId: string;
  userEmail: string;
  userName: string;
  userEmailDisplay: string;
  signedAt: string;
  status: string;
  signedVersion: number | null;
};

const statusColors: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  pending_approval: "bg-yellow-100 text-yellow-800",
  rejected: "bg-red-100 text-red-800",
  expiring: "bg-orange-100 text-orange-800",
  expired: "bg-gray-100 text-gray-600",
};

const statusFilters = ["all", "approved", "expiring", "expired", "pending_approval", "rejected"] as const;

export function WaiverAuditLog({ waivers }: { waivers: Waiver[] }) {
  const t = useTranslations("dashboard.members");
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all" ? waivers : waivers.filter((w) => w.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {statusFilters.map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === "all" ? t("all") : f}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {t("noWaivers")}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((w) => (
            <Card key={w.fileId}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium">{w.userName}</div>
                    <div className="text-sm text-muted-foreground">
                      {w.userEmailDisplay}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(w.signedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge className={statusColors[w.status] || ""}>
                      {w.status}
                    </Badge>
                    {w.signedVersion ? (
                      <Badge variant="outline">
                        {t("eSignedBadge", { version: w.signedVersion })}
                      </Badge>
                    ) : !w.fileId.startsWith("esign-") ? (
                      <a
                        href={`/api/waivers/view/${w.fileId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </a>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
