"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WaiverSignInline } from "@/components/waiver-sign-inline";

type Waiver = {
  fileId: string;
  status: string;
  signedAt: string;
  signedVersion?: number | null;
};

type WaiverStatus = {
  hasValidWaiver: boolean;
  expiresAt: string | null;
  validityDays: number;
};

const statusColors: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  pending_approval: "bg-yellow-100 text-yellow-800",
  rejected: "bg-red-100 text-red-800",
  expiring: "bg-orange-100 text-orange-800",
  expired: "bg-gray-100 text-gray-600",
};

export default function MyWaiversPage() {
  const t = useTranslations("dashboard.myWaivers");
  const [waivers, setWaivers] = useState<Waiver[]>([]);
  const [waiverStatus, setWaiverStatus] = useState<WaiverStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSignForm, setShowSignForm] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      const [waiversRes, statusRes] = await Promise.all([
        fetch("/api/users/me/waivers"),
        fetch("/api/users/me/waivers/status"),
      ]);
      if (waiversRes.ok) setWaivers(await waiversRes.json());
      if (statusRes.ok) setWaiverStatus(await statusRes.json());
    } finally {
      setLoading(false);
    }
  }

  function handleSigned() {
    setShowSignForm(false);
    setLoading(true);
    fetchAll();
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  }

  const hasValid = waiverStatus?.hasValidWaiver;
  const validityDays = waiverStatus?.validityDays ?? 365;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>

      {/* Current waiver status */}
      {hasValid && !showSignForm ? (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{t("currentStatus")}</span>
                  <Badge className="bg-green-100 text-green-800">{t("valid")}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("validUntil", {
                    date: new Date(waiverStatus!.expiresAt!).toLocaleDateString(),
                  })}
                </div>
              </div>
              <Button variant="outline" onClick={() => setShowSignForm(true)}>
                {t("reSign")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">{t("signWaiver")}</CardTitle>
          </CardHeader>
          <CardContent>
            <WaiverSignInline onSigned={handleSigned} validityDays={validityDays} />
          </CardContent>
        </Card>
      )}

      {/* Waiver history */}
      {waivers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {t("noWaivers")}
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t("history")}</h2>
          {waivers.map((w) => (
            <Card key={w.fileId}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-muted-foreground">
                      {t("submittedOn")}: {new Date(w.signedAt).toLocaleDateString()}
                    </div>
                    {w.signedVersion && (
                      <div className="text-xs text-muted-foreground">
                        {t("eSigned", { version: w.signedVersion })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[w.status] || ""}>
                      {w.status}
                    </Badge>
                    {!w.fileId.startsWith("esign-") && (
                      <a
                        href={`/api/waivers/view/${w.fileId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </a>
                    )}
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
