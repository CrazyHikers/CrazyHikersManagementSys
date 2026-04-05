"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Waiver = {
  fileId: string;
  status: string;
  signedAt: string;
};

const statusColors: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  pending_approval: "bg-yellow-100 text-yellow-800",
  declined: "bg-red-100 text-red-800",
};

export default function MyWaiversPage() {
  const t = useTranslations("dashboard.myWaivers");
  const [waivers, setWaivers] = useState<Waiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchWaivers();
  }, []);

  async function fetchWaivers() {
    try {
      const res = await fetch("/api/users/me/waivers");
      if (res.ok) {
        const data = await res.json();
        setWaivers(data);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);

    const formData = new FormData(e.currentTarget);
    const file = formData.get("waiver") as File;

    if (!file || file.size === 0) {
      toast.error("Please select a file");
      setUploading(false);
      return;
    }

    const uploadData = new FormData();
    uploadData.append("file", file);
    uploadData.append("folder", "waivers");

    try {
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: uploadData,
      });

      if (!uploadRes.ok) throw new Error("Upload failed");

      const { key } = await uploadRes.json();

      const res = await fetch("/api/users/me/waivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: key }),
      });

      if (!res.ok) throw new Error("Failed to submit waiver");

      toast.success(t("uploadSuccess"));
      (e.target as HTMLFormElement).reset();
      fetchWaivers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>

      {/* Download template */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{t("downloadTemplate")}</div>
              <div className="text-sm text-muted-foreground">{t("downloadTemplateDesc")}</div>
            </div>
            <a href="/waiver-template.pdf" download>
              <Button variant="outline">{t("download")}</Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Upload form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">{t("uploadWaiver")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1 flex-1 min-w-48">
              <Label htmlFor="waiver">{t("selectFile")}</Label>
              <Input
                id="waiver"
                name="waiver"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                required
              />
            </div>
            <Button
              type="submit"
              className="bg-green-600 hover:bg-green-700"
              disabled={uploading}
            >
              {uploading ? "..." : t("submit")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Waiver list */}
      {waivers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {t("noWaivers")}
        </div>
      ) : (
        <div className="space-y-3">
          {waivers.map((w) => (
            <Card key={w.fileId}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-muted-foreground">
                      {t("submittedOn")}: {new Date(w.signedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[w.status] || ""}>
                      {w.status}
                    </Badge>
                    <a
                      href={`/api/waivers/view/${w.fileId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </a>
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
