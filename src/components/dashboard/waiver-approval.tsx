"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

type Waiver = {
  fileId: string;
  userEmail: string;
  userName: string;
  userEmailDisplay: string;
  signedAt: string;
};

export function WaiverApprovalList({
  initialWaivers,
}: {
  initialWaivers: Waiver[];
}) {
  const t = useTranslations("dashboard.members");
  const [waivers, setWaivers] = useState(initialWaivers);
  const [processing, setProcessing] = useState<string | null>(null);

  const handleAction = useCallback(
    async (fileId: string, userEmail: string, action: "approve" | "decline") => {
      setProcessing(fileId);
      try {
        const res = await fetch("/api/waivers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId, userEmail, action }),
        });
        if (!res.ok) throw new Error("Failed");

        setWaivers((prev) => prev.filter((w) => w.fileId !== fileId));
        toast.success(action === "approve" ? "Approved" : "Declined");
      } catch {
        toast.error("Failed");
      } finally {
        setProcessing(null);
      }
    },
    []
  );

  if (waivers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No pending waivers
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {waivers.map((w) => (
        <Card key={w.fileId} className={processing === w.fileId ? "opacity-60" : ""}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium">{w.userName}</div>
                <div className="text-sm text-muted-foreground">
                  {w.userEmailDisplay}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Submitted: {new Date(w.signedAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <a
                  href={`/api/waivers/view/${w.fileId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm">
                    View
                  </Button>
                </a>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleAction(w.fileId, w.userEmail, "approve")}
                  disabled={processing === w.fileId}
                >
                  {t("approveWaiver")}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleAction(w.fileId, w.userEmail, "decline")}
                  disabled={processing === w.fileId}
                >
                  {t("declineWaiver")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
