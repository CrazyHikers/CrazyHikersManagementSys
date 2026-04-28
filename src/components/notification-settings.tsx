"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Bell, BellOff, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Status =
  | { kind: "loading" }
  | { kind: "unsupported" }
  | { kind: "needs-pwa-ios" }
  | { kind: "permission-denied" }
  | { kind: "ready"; subscribed: boolean };

type Prefs = {
  activity_created: boolean;
  registration_confirmed: boolean;
};

const PREF_KEYS: (keyof Prefs)[] = ["activity_created", "registration_confirmed"];

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !(window as any).MSStream
  );
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.navigator as any).standalone === true
  );
}

export function NotificationSettings() {
  const t = useTranslations("dashboard.notifications");
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    void detectStatus().then(setStatus);
    void fetchPrefs();
  }, []);

  async function fetchPrefs() {
    try {
      const res = await fetch("/api/notifications/preferences");
      if (res.ok) setPrefs(await res.json());
    } catch (err) {
      console.error("[notifications] fetch prefs failed:", err);
    }
  }

  async function detectStatus(): Promise<Status> {
    if (typeof window === "undefined") return { kind: "loading" };

    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    if (!supported) return { kind: "unsupported" };

    if (isIos() && !isStandalone()) return { kind: "needs-pwa-ios" };

    if (Notification.permission === "denied") {
      return { kind: "permission-denied" };
    }

    let registration: ServiceWorkerRegistration;
    try {
      registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      await navigator.serviceWorker.ready;
    } catch (err) {
      console.error("[notifications] SW registration failed:", err);
      return { kind: "unsupported" };
    }

    const sub = await registration.pushManager.getSubscription();
    return { kind: "ready", subscribed: !!sub };
  }

  async function handleEnable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        if (permission === "denied") setStatus({ kind: "permission-denied" });
        toast.error(t("permissionRequired"));
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        toast.error("VAPID public key missing");
        return;
      }

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
          .buffer as ArrayBuffer,
      });

      const json = sub.toJSON();
      const res = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) {
        await sub.unsubscribe();
        throw new Error(await res.text());
      }

      setStatus({ kind: "ready", subscribed: true });
      toast.success(t("enabled"));
    } catch (err) {
      console.error("[notifications] enable failed:", err);
      toast.error(t("enableFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      const endpoint = sub?.endpoint;

      if (sub) await sub.unsubscribe();

      await fetch("/api/notifications/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(endpoint ? { endpoint } : { all: true }),
      });

      setStatus({ kind: "ready", subscribed: false });
      toast.success(t("disabled"));
    } catch (err) {
      console.error("[notifications] disable failed:", err);
      toast.error(t("disableFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function togglePref(key: keyof Prefs, value: boolean) {
    if (!prefs) return;
    const previous = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next); // optimistic
    setSavingPrefs(true);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error(await res.text());
      setPrefs(await res.json());
    } catch (err) {
      console.error("[notifications] toggle pref failed:", err);
      setPrefs(previous);
      toast.error(t("prefSaveFailed"));
    } finally {
      setSavingPrefs(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="h-5 w-5" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("description")}</p>

        {status.kind === "loading" && (
          <p className="text-sm text-muted-foreground">{t("checking")}</p>
        )}

        {status.kind === "unsupported" && (
          <Notice tone="warn">
            <p className="font-medium">{t("unsupportedTitle")}</p>
            <p className="text-sm">{t("unsupportedBody")}</p>
          </Notice>
        )}

        {status.kind === "needs-pwa-ios" && (
          <Notice tone="info">
            <p className="font-medium">{t("iosTitle")}</p>
            <ol className="text-sm list-decimal list-inside space-y-1 mt-2">
              <li>{t("iosStep1")}</li>
              <li>{t("iosStep2")}</li>
              <li>{t("iosStep3")}</li>
            </ol>
          </Notice>
        )}

        {status.kind === "permission-denied" && (
          <Notice tone="warn">
            <p className="font-medium">{t("deniedTitle")}</p>
            <p className="text-sm">{t("deniedBody")}</p>
          </Notice>
        )}

        {status.kind === "ready" && status.subscribed && (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm flex items-center gap-2">
                <Bell className="h-4 w-4 text-green-600" />
                {t("subscribedOnDevice")}
              </p>
              <Button
                variant="outline"
                onClick={handleDisable}
                disabled={busy}
                className="gap-2"
              >
                <BellOff className="h-4 w-4" />
                {busy ? "..." : t("disable")}
              </Button>
            </div>

            {prefs && (
              <div className="border-t pt-3">
                <p className="text-sm font-medium mb-2">{t("prefsTitle")}</p>
                <div className="space-y-2">
                  {PREF_KEYS.map((key) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={prefs[key]}
                        onChange={(e) => togglePref(key, e.target.checked)}
                        disabled={savingPrefs}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <span>{t(`prefs.${key}`)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {status.kind === "ready" && !status.subscribed && (
          <div>
            <Button
              onClick={handleEnable}
              disabled={busy}
              className="bg-green-600 hover:bg-green-700 gap-2"
            >
              <Bell className="h-4 w-4" />
              {busy ? "..." : t("enable")}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              {t("enableHint")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "info" | "warn";
  children: React.ReactNode;
}) {
  const cls =
    tone === "warn"
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : "border-blue-300 bg-blue-50 text-blue-900";
  return (
    <div className={`rounded-md border p-3 ${cls}`}>
      <div className="flex gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
