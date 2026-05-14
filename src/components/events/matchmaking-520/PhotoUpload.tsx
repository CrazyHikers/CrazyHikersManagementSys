"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Props = {
  value: string; // photoKey (R2 key)
  onChange: (key: string) => void;
  publicUrlFor: (key: string) => string;
};

const ACCEPTED = "image/jpeg,image/png,image/webp";
const FOLDER = "matchmaking-520";

export function PhotoUpload({ value, onChange, publicUrlFor }: Props) {
  const t = useTranslations("events.matchmaking520.wizard");
  const tf = useTranslations("events.matchmaking520.wizard.fields");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", FOLDER);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }
      const { key } = (await res.json()) as { key: string };
      onChange(key);
      toast.success(t("photoUploaded"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const previewUrl = value ? publicUrlFor(value) : "";

  return (
    <div className="space-y-2">
      <Label className="gap-0.5">
        {tf("photo")}
        <span className="text-red-500">*</span>
      </Label>
      <p className="text-xs text-muted-foreground">{tf("photoHelp")}</p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        onChange={handleChange}
        className="hidden"
        id="m520-photo-input"
      />
      {value ? (
        <div className="flex items-start gap-3">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              className="h-24 w-24 rounded-lg object-cover border"
            />
          ) : (
            <div className="h-24 w-24 rounded-lg border bg-rose-100 flex items-center justify-center text-rose-700 text-xs">
              {t("photoUploaded")}
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? t("uploading") : t("photoChange")}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? t("uploading") : tf("photo")}
        </Button>
      )}
    </div>
  );
}
