"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

export function AttendeeAlbumLink({ activityId }: { activityId: string }) {
  const { data: session } = useSession();
  const email = session?.user?.email;
  const t = useTranslations("recap");
  const [album, setAlbum] = useState<{ activityId: string; email: string; url: string } | null>(null);
  useEffect(() => {
    if (!email) return;
    const controller = new AbortController();
    fetch(`/api/activities/${activityId}/album`, { cache: "no-store", signal: controller.signal })
      .then(async (res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!controller.signal.aborted) setAlbum(data?.albumUrl ? { activityId, email, url: data.albumUrl } : null);
      }).catch(() => {});
    return () => controller.abort();
  }, [activityId, email]);
  if (!album || album.email !== email || album.activityId !== activityId) return null;
  return <a className="inline-block mb-6 text-green-700 underline underline-offset-4" href={album.url} target="_blank" rel="noopener noreferrer">{t("viewAlbum")}</a>;
}
