"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasActivityRecap, MAX_RECAP_PHOTOS, MAX_RECAP_TEXT, type ActivityRecap } from "@/lib/activity-recap";

export function ActivityRecapEditor({ activityId, initialRecap, version, publicUrlPrefix, initialOpen = false }: {
  activityId: string; initialRecap: ActivityRecap | null; version: string; publicUrlPrefix: string; initialOpen?: boolean;
}) {
  const t = useTranslations("recap");
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(initialOpen);
  const [recap, setRecap] = useState<ActivityRecap>(initialRecap ?? { albumUrl: "", description: "", photoKeys: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function close() {
    setOpen(false);
    if (initialOpen) router.replace(pathname, { scroll: false });
  }

  async function upload(files: File[]) {
    if (!files.length) return;
    if (recap.photoKeys.length + files.length > MAX_RECAP_PHOTOS) { setError(t("photoLimit", { count: MAX_RECAP_PHOTOS })); return; }
    setBusy(true);
    setError("");
    try {
      for (const file of files) {
        const data = new FormData();
        data.append("file", file);
        data.append("folder", `activity-recaps/${activityId}`);
        const response = await fetch("/api/upload", { method: "POST", body: data });
        if (!response.ok) throw new Error(t("uploadFailed"));
        const { key } = await response.json();
        setRecap((current) => ({ ...current, photoKeys: [...current.photoKeys, key] }));
      }
    } catch { setError(t("uploadFailed")); }
    finally { setBusy(false); }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/activities/${activityId}/recap`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...recap, version }),
      });
      if (!response.ok) { setError(t(response.status === 409 ? "conflict" : "saveFailed")); return; }
      toast.success(t("saved"));
      close();
      router.refresh();
    } catch { setError(t("saveFailed")); }
    finally { setBusy(false); }
  }

  return (
    <Card className="mb-6" id="activity-recap-editor">
      <CardHeader><CardTitle>{t("title")}</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">{t("publicHelp")}</p>
        {!open ? <Button variant="outline" onClick={() => setOpen(true)}>{t(hasActivityRecap(initialRecap) ? "edit" : "add")}</Button> : (
          <form onSubmit={save} className="space-y-4">
            <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
              <div className="space-y-2">
                <Label htmlFor="recap-album">{t("albumLabel")}</Label>
                <Input id="recap-album" type="url" pattern="https://.*" placeholder="https://…" maxLength={2048} value={recap.albumUrl} onChange={(e) => setRecap({ ...recap, albumUrl: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recap-description">{t("descriptionLabel")}</Label>
                <Textarea id="recap-description" rows={6} maxLength={MAX_RECAP_TEXT} value={recap.description} onChange={(e) => setRecap({ ...recap, description: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recap-photos">{t("photosLabel")}</Label>
                <p className="text-sm text-muted-foreground">{t("photoLimit", { count: MAX_RECAP_PHOTOS })}</p>
                <Input id="recap-photos" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; void upload(files); }} />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {recap.photoKeys.map((key, index) => (
                    <div key={key} className="space-y-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${publicUrlPrefix}/${key}`} alt={t("photoAlt", { number: index + 1 })} className="w-full aspect-[4/3] rounded-lg object-cover" />
                      <Button type="button" variant="outline" size="sm" aria-label={t("removePhoto", { number: index + 1 })} onClick={() => setRecap({ ...recap, photoKeys: recap.photoKeys.filter((k) => k !== key) })}>{t("remove")}</Button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit">{busy ? t("working") : t("save")}</Button>
                <Button type="button" variant="outline" onClick={close}>{t("later")}</Button>
              </div>
            </fieldset>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
