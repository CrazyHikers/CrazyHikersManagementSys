"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type TemplateInfo = {
  version: number | null;
  filename?: string;
  uploadedAt?: string;
  uploadedBy?: string;
};

export function WaiverTemplateUpload() {
  const t = useTranslations("dashboard.settings");
  const [info, setInfo] = useState<TemplateInfo>({ version: null });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchInfo();
  }, []);

  async function fetchInfo() {
    try {
      const res = await fetch("/api/waiver-templates");
      if (res.ok) {
        setInfo(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error(t("waiverPdfOnly"));
      return;
    }

    const confirmed = window.confirm(t("waiverUploadConfirm"));
    if (!confirmed) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/waiver-templates", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      toast.success(t("waiverUploadSuccess"));
      if (fileRef.current) fileRef.current.value = "";
      await fetchInfo();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("waiverTemplate")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {info.version ? (
          <div className="rounded-md bg-gray-50 p-4 text-sm space-y-1">
            <div>
              <span className="text-muted-foreground">{t("waiverCurrentVersion")}: </span>
              <span className="font-medium">v{info.version}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t("waiverFilename")}: </span>
              {info.filename}
            </div>
            <div>
              <span className="text-muted-foreground">{t("waiverUploadedAt")}: </span>
              {info.uploadedAt
                ? new Date(info.uploadedAt).toLocaleString()
                : "-"}
            </div>
            <div>
              <span className="text-muted-foreground">{t("waiverUploadedBy")}: </span>
              {info.uploadedBy}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("waiverNoTemplate")}</p>
        )}

        <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          {t("waiverUploadWarning")}
        </div>

        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,application/pdf"
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-green-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-green-700 hover:file:bg-green-100"
          />
          <Button
            onClick={handleUpload}
            disabled={uploading}
            className="bg-green-600 hover:bg-green-700"
          >
            {uploading ? "..." : t("waiverUploadButton")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
