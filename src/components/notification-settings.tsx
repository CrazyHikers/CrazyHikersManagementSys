"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Bell, BellOff, AlertTriangle, MessageCircle, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PushStatus =
  | { kind: "loading" }
  | { kind: "unsupported" }
  | { kind: "needs-pwa-ios" }
  | { kind: "permission-denied" }
  | { kind: "ready"; subscribed: boolean };

type TelegramStatus =
  | { kind: "loading" }
  | { kind: "not-configured" }
  | { kind: "not-linked" }
  | { kind: "linked"; username: string | null };

type DiscordStatus =
  | { kind: "loading" }
  | { kind: "not-configured" }
  | { kind: "not-linked" }
  | { kind: "linked"; username: string | null };

type Prefs = {
  activity_created: boolean;
  registration_confirmed: boolean;
  poll_published: boolean;
  comanager_invited: boolean;
  comanager_response: boolean;
  confirm_registrations_reminder: boolean;
  finalize_activity_reminder: boolean;
};

type NotificationTranslator = ReturnType<typeof useTranslations>;

const MEMBER_PREF_KEYS: (keyof Prefs)[] = [
  "activity_created",
  "registration_confirmed",
  "poll_published",
];

const MANAGER_PREF_KEYS: (keyof Prefs)[] = [
  "comanager_invited",
  "comanager_response",
  "confirm_registrations_reminder",
  "finalize_activity_reminder",
];

const MANAGER_ROLES = ["manager", "admin", "dev"];

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

export function NotificationSettings({ userRole }: { userRole?: string }) {
  const t = useTranslations("dashboard.notifications");
  const showManagerPrefs = !!userRole && MANAGER_ROLES.includes(userRole);

  const [pushStatus, setPushStatus] = useState<PushStatus>({ kind: "loading" });
  const [pushBusy, setPushBusy] = useState(false);

  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus>({
    kind: "loading",
  });
  const [telegramBusy, setTelegramBusy] = useState(false);

  const [discordStatus, setDiscordStatus] = useState<DiscordStatus>({
    kind: "loading",
  });
  const [discordBusy, setDiscordBusy] = useState(false);

  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    void detectPushStatus().then(setPushStatus);
    void fetchTelegramStatus();
    void fetchDiscordStatus();
    void fetchPrefs();
    handleDiscordCallbackParams();
  }, []);

  // The Discord OAuth flow redirects back to this page with ?discord=<status>.
  // Translate that into a toast and clean the URL so a refresh doesn't
  // re-fire the message.
  function handleDiscordCallbackParams() {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get("discord");
    if (!status) return;

    if (status === "linked") toast.success(t("discordLinked"));
    else if (status === "not_in_guild") toast.error(t("discordNotInGuild"));
    else if (status === "already_linked")
      toast.error(t("discordAlreadyLinked"));
    else if (status === "denied") toast.error(t("discordDenied"));
    else toast.error(t("discordLinkFailed"));

    params.delete("discord");
    const cleaned =
      window.location.pathname +
      (params.toString() ? `?${params.toString()}` : "");
    window.history.replaceState({}, "", cleaned);
  }

  async function fetchPrefs() {
    try {
      const res = await fetch("/api/notifications/preferences");
      if (res.ok) setPrefs(await res.json());
    } catch (err) {
      console.error("[notifications] fetch prefs failed:", err);
    }
  }

  async function fetchTelegramStatus() {
    try {
      const res = await fetch("/api/notifications/telegram/status");
      if (!res.ok) {
        setTelegramStatus({ kind: "not-configured" });
        return;
      }
      const data = await res.json();
      if (!data.configured) setTelegramStatus({ kind: "not-configured" });
      else if (data.linked)
        setTelegramStatus({ kind: "linked", username: data.username });
      else setTelegramStatus({ kind: "not-linked" });
    } catch (err) {
      console.error("[notifications] telegram status failed:", err);
      setTelegramStatus({ kind: "not-configured" });
    }
  }

  async function fetchDiscordStatus() {
    try {
      const res = await fetch("/api/notifications/discord/status");
      if (!res.ok) {
        setDiscordStatus({ kind: "not-configured" });
        return;
      }
      const data = await res.json();
      if (!data.configured) setDiscordStatus({ kind: "not-configured" });
      else if (data.linked)
        setDiscordStatus({ kind: "linked", username: data.username });
      else setDiscordStatus({ kind: "not-linked" });
    } catch (err) {
      console.error("[notifications] discord status failed:", err);
      setDiscordStatus({ kind: "not-configured" });
    }
  }

  async function detectPushStatus(): Promise<PushStatus> {
    if (typeof window === "undefined") return { kind: "loading" };

    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    if (!supported) return { kind: "unsupported" };

    if (isIos() && !isStandalone()) return { kind: "needs-pwa-ios" };
    if (Notification.permission === "denied")
      return { kind: "permission-denied" };

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

  async function handlePushEnable() {
    setPushBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        if (permission === "denied")
          setPushStatus({ kind: "permission-denied" });
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

      setPushStatus({ kind: "ready", subscribed: true });
      toast.success(t("enabled"));
    } catch (err) {
      console.error("[notifications] enable failed:", err);
      toast.error(t("enableFailed"));
    } finally {
      setPushBusy(false);
    }
  }

  async function handlePushDisable() {
    setPushBusy(true);
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

      setPushStatus({ kind: "ready", subscribed: false });
      toast.success(t("disabled"));
    } catch (err) {
      console.error("[notifications] disable failed:", err);
      toast.error(t("disableFailed"));
    } finally {
      setPushBusy(false);
    }
  }

  async function handleTelegramLink() {
    setTelegramBusy(true);
    try {
      const res = await fetch("/api/notifications/telegram/link-token", {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      // Open Telegram in a new tab. Once the user clicks Start in Telegram,
      // the bot's webhook binds the chat to their account; we poll status
      // for ~2 minutes to update the UI without requiring a refresh.
      window.open(data.url, "_blank", "noopener,noreferrer");
      pollTelegramStatusUntilLinked();
      toast.info(t("telegramLinkOpening"));
    } catch (err) {
      console.error("[notifications] telegram link failed:", err);
      toast.error(t("telegramLinkFailed"));
    } finally {
      setTelegramBusy(false);
    }
  }

  function pollTelegramStatusUntilLinked() {
    let elapsed = 0;
    const interval = setInterval(async () => {
      elapsed += 3000;
      try {
        const res = await fetch("/api/notifications/telegram/status");
        if (res.ok) {
          const data = await res.json();
          if (data.linked) {
            setTelegramStatus({ kind: "linked", username: data.username });
            toast.success(t("telegramLinked"));
            clearInterval(interval);
            return;
          }
        }
      } catch {
        // Ignore transient failures; keep polling.
      }
      if (elapsed >= 120_000) clearInterval(interval);
    }, 3000);
  }

  async function handleTelegramUnlink() {
    setTelegramBusy(true);
    try {
      const res = await fetch("/api/notifications/telegram/unlink", {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      setTelegramStatus({ kind: "not-linked" });
      toast.success(t("telegramUnlinked"));
    } catch (err) {
      console.error("[notifications] telegram unlink failed:", err);
      toast.error(t("telegramUnlinkFailed"));
    } finally {
      setTelegramBusy(false);
    }
  }

  async function handleDiscordLink() {
    setDiscordBusy(true);
    try {
      const res = await fetch("/api/notifications/discord/link-token", {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      // Full-page redirect — the OAuth flow needs to come back to our
      // callback, which then redirects to this page with ?discord=<status>.
      window.location.href = data.url;
    } catch (err) {
      console.error("[notifications] discord link failed:", err);
      toast.error(t("discordLinkFailed"));
      setDiscordBusy(false);
    }
  }

  async function handleDiscordUnlink() {
    setDiscordBusy(true);
    try {
      const res = await fetch("/api/notifications/discord/unlink", {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      setDiscordStatus({ kind: "not-linked" });
      toast.success(t("discordUnlinked"));
    } catch (err) {
      console.error("[notifications] discord unlink failed:", err);
      toast.error(t("discordUnlinkFailed"));
    } finally {
      setDiscordBusy(false);
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

  // Show prefs only once the user has at least one active channel — no
  // point asking them to choose what to receive when nothing's wired up.
  const anyChannelActive =
    (pushStatus.kind === "ready" && pushStatus.subscribed) ||
    telegramStatus.kind === "linked" ||
    discordStatus.kind === "linked";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="h-5 w-5" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">{t("description")}</p>

        {/* Push channel */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-2">{t("pushSectionTitle")}</p>
          <PushChannelBody
            status={pushStatus}
            busy={pushBusy}
            t={t}
            onEnable={handlePushEnable}
            onDisable={handlePushDisable}
          />
        </div>

        {/* Telegram channel */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-2 flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            {t("telegramSectionTitle")}
          </p>
          <TelegramChannelBody
            status={telegramStatus}
            busy={telegramBusy}
            t={t}
            onLink={handleTelegramLink}
            onUnlink={handleTelegramUnlink}
          />
        </div>

        {/* Discord channel */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-2 flex items-center gap-2">
            <Hash className="h-4 w-4" />
            {t("discordSectionTitle")}
          </p>
          <DiscordChannelBody
            status={discordStatus}
            busy={discordBusy}
            t={t}
            onLink={handleDiscordLink}
            onUnlink={handleDiscordUnlink}
          />
        </div>

        {/* Per-event preferences (shared across all channels) */}
        {anyChannelActive && prefs && (
          <div className="border-t pt-4 space-y-4">
            <p className="text-sm font-medium">{t("prefsTitle")}</p>
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                {t("memberGroupTitle")}
              </p>
              <div className="space-y-2">
                {MEMBER_PREF_KEYS.map((key) => (
                  <PrefCheckbox
                    key={key}
                    label={t(`prefs.${key}`)}
                    checked={prefs[key]}
                    disabled={savingPrefs}
                    onChange={(v) => togglePref(key, v)}
                  />
                ))}
              </div>
            </div>

            {showManagerPrefs && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  {t("managerGroupTitle")}
                </p>
                <div className="space-y-2">
                  {MANAGER_PREF_KEYS.map((key) => (
                    <PrefCheckbox
                      key={key}
                      label={t(`prefs.${key}`)}
                      checked={prefs[key]}
                      disabled={savingPrefs}
                      onChange={(v) => togglePref(key, v)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PushChannelBody(props: {
  status: PushStatus;
  busy: boolean;
  t: NotificationTranslator;
  onEnable: () => void;
  onDisable: () => void;
}) {
  const { status, busy, t, onEnable, onDisable } = props;

  if (status.kind === "loading") {
    return <p className="text-sm text-muted-foreground">{t("checking")}</p>;
  }

  if (status.kind === "unsupported") {
    return (
      <>
        <Notice tone="warn">
          <p className="font-medium">{t("unsupportedTitle")}</p>
          <p className="text-sm">{t("unsupportedBody")}</p>
        </Notice>
        <DisabledEnableButton t={t} className="mt-3" />
      </>
    );
  }

  if (status.kind === "needs-pwa-ios") {
    return (
      <>
        <Notice tone="info">
          <p className="font-medium">{t("iosTitle")}</p>
          <ol className="text-sm list-decimal list-inside space-y-1 mt-2">
            <li>{t("iosStep1")}</li>
            <li>{t("iosStep2")}</li>
            <li>{t("iosStep3")}</li>
          </ol>
        </Notice>
        <DisabledEnableButton t={t} className="mt-3" />
      </>
    );
  }

  if (status.kind === "permission-denied") {
    return (
      <>
        <Notice tone="warn">
          <p className="font-medium">{t("deniedTitle")}</p>
          <p className="text-sm">{t("deniedBody")}</p>
        </Notice>
        <DisabledEnableButton t={t} className="mt-3" />
      </>
    );
  }

  // ready
  if (status.subscribed) {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm flex items-center gap-2">
          <Bell className="h-4 w-4 text-green-600" />
          {t("subscribedOnDevice")}
        </p>
        <Button
          variant="outline"
          onClick={onDisable}
          disabled={busy}
          className="gap-2"
        >
          <BellOff className="h-4 w-4" />
          {busy ? "..." : t("disable")}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Button
        onClick={onEnable}
        disabled={busy}
        className="bg-green-600 hover:bg-green-700 gap-2"
      >
        <Bell className="h-4 w-4" />
        {busy ? "..." : t("enable")}
      </Button>
      <p className="text-xs text-muted-foreground mt-2">{t("enableHint")}</p>
    </div>
  );
}

function DisabledEnableButton({
  t,
  className,
}: {
  t: NotificationTranslator;
  className?: string;
}) {
  return (
    <Button disabled className={`gap-2 ${className ?? ""}`}>
      <Bell className="h-4 w-4" />
      {t("enable")}
    </Button>
  );
}

function TelegramChannelBody(props: {
  status: TelegramStatus;
  busy: boolean;
  t: NotificationTranslator;
  onLink: () => void;
  onUnlink: () => void;
}) {
  const { status, busy, t, onLink, onUnlink } = props;

  if (status.kind === "loading") {
    return <p className="text-sm text-muted-foreground">{t("checking")}</p>;
  }

  if (status.kind === "not-configured") {
    return (
      <p className="text-sm text-muted-foreground">
        {t("telegramNotConfigured")}
      </p>
    );
  }

  if (status.kind === "linked") {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-green-600" />
          {status.username
            ? t("telegramLinkedAs", { username: status.username })
            : t("telegramLinkedNoUsername")}
        </p>
        <Button
          variant="outline"
          onClick={onUnlink}
          disabled={busy}
          className="gap-2"
        >
          {busy ? "..." : t("telegramUnlink")}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Button
        onClick={onLink}
        disabled={busy}
        className="bg-blue-600 hover:bg-blue-700 gap-2"
      >
        <MessageCircle className="h-4 w-4" />
        {busy ? "..." : t("telegramLink")}
      </Button>
      <p className="text-xs text-muted-foreground mt-2">
        {t("telegramLinkHint")}
      </p>
    </div>
  );
}

function DiscordChannelBody(props: {
  status: DiscordStatus;
  busy: boolean;
  t: NotificationTranslator;
  onLink: () => void;
  onUnlink: () => void;
}) {
  const { status, busy, t, onLink, onUnlink } = props;

  if (status.kind === "loading") {
    return <p className="text-sm text-muted-foreground">{t("checking")}</p>;
  }

  if (status.kind === "not-configured") {
    return (
      <p className="text-sm text-muted-foreground">
        {t("discordNotConfigured")}
      </p>
    );
  }

  if (status.kind === "linked") {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm flex items-center gap-2">
          <Hash className="h-4 w-4 text-green-600" />
          {status.username
            ? t("discordLinkedAs", { username: status.username })
            : t("discordLinkedNoUsername")}
        </p>
        <Button
          variant="outline"
          onClick={onUnlink}
          disabled={busy}
          className="gap-2"
        >
          {busy ? "..." : t("discordUnlink")}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Button
        onClick={onLink}
        disabled={busy}
        className="bg-indigo-600 hover:bg-indigo-700 gap-2"
      >
        <Hash className="h-4 w-4" />
        {busy ? "..." : t("discordLink")}
      </Button>
      <p className="text-xs text-muted-foreground mt-2">
        {t("discordLinkHint")}
      </p>
    </div>
  );
}

function PrefCheckbox({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-4 w-4 rounded border-gray-300"
      />
      <span>{label}</span>
    </label>
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
