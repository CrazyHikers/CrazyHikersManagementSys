"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const MAX_UPLOAD_MB = 100;

export function InternResourcesUpload() {
  const t = useTranslations("dashboard.internResources");
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"DOCUMENT" | "VIDEO">("DOCUMENT");
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error(t("uploadMissingFile"));
      return;
    }
    if (!title.trim()) {
      toast.error(t("uploadMissingTitle"));
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      toast.error(t("uploadTooLarge", { limitMb: MAX_UPLOAD_MB }));
      return;
    }

    setUploading(true);
    try {
      const mime = file.type || "application/octet-stream";

      const presignRes = await fetch("/api/intern-resources/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mime,
          sizeBytes: file.size,
          kind,
        }),
      });
      if (!presignRes.ok) {
        const data = await presignRes.json().catch(() => ({}));
        throw new Error(data.error || t("uploadFailed"));
      }
      const { uploadUrl, key } = (await presignRes.json()) as {
        uploadUrl: string;
        key: string;
      };

      // Direct browser → R2 PUT. Bypasses Vercel's 4.5 MB function body limit.
      // Requires the R2 bucket to allow PUT from this app's origin via CORS.
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": mime },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(t("uploadStorageFailed"));
      }

      const confirmRes = await fetch("/api/intern-resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, title: title.trim(), kind }),
      });
      if (!confirmRes.ok) {
        const data = await confirmRes.json().catch(() => ({}));
        throw new Error(data.error || t("uploadFailed"));
      }

      toast.success(t("uploadSuccess"));
      setTitle("");
      setKind("DOCUMENT");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">{t("uploadTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleUpload} className="space-y-4 max-w-xl">
          <div className="space-y-1">
            <Label htmlFor="intern-resource-title">{t("titleLabel")}</Label>
            <Input
              id="intern-resource-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("titlePlaceholder")}
              maxLength={200}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="intern-resource-kind">{t("kindLabel")}</Label>
            <Select
              value={kind}
              onValueChange={(v) => {
                if (v === "DOCUMENT" || v === "VIDEO") setKind(v);
              }}
            >
              <SelectTrigger id="intern-resource-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DOCUMENT">{t("kind_DOCUMENT")}</SelectItem>
                <SelectItem value="VIDEO">{t("kind_VIDEO")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="intern-resource-file">{t("fileLabel")}</Label>
            <input
              id="intern-resource-file"
              ref={fileRef}
              type="file"
              className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-green-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-green-700 hover:file:bg-green-100"
            />
          </div>

          <Button
            type="submit"
            disabled={uploading}
            className="bg-green-600 hover:bg-green-700"
          >
            {uploading ? "..." : t("uploadButton")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
