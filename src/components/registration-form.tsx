"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type SessionUser = {
  name?: string | null;
  email?: string | null;
} | null;

export function RegistrationForm({
  activityId,
  session,
}: {
  activityId: string;
  session?: SessionUser;
}) {
  const t = useTranslations("activity");
  const [loading, setLoading] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(!!session?.email);

  // Check if user is already registered
  useEffect(() => {
    if (!session?.email) return;
    fetch(`/api/activities/${activityId}/register/status`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status) setRegistrationStatus(data.status);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [activityId, session?.email]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      email: (formData.get("email") as string) || session?.email || "",
      name: (formData.get("name") as string) || session?.name || "",
      notes: formData.get("notes") as string,
    };

    try {
      const res = await fetch(`/api/activities/${activityId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Registration failed");
      }

      toast.success(t("registrationSuccess"));
      setRegistrationStatus("registered");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleWithdraw() {
    setLoading(true);
    try {
      const res = await fetch(`/api/activities/${activityId}/register`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Withdraw failed");
      }
      toast.success(t("withdrawSuccess"));
      setRegistrationStatus(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Withdraw failed");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return <div className="text-center py-4 text-muted-foreground">...</div>;
  }

  // Already registered — show status and withdraw button
  if (registrationStatus) {
    const statusLabels: Record<string, string> = {
      registered: t("statusRegistered"),
      registration_confirmed: t("statusConfirmed"),
    };
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{t("yourStatus")}:</span>
          <Badge className={
            registrationStatus === "registration_confirmed"
              ? "bg-green-100 text-green-800"
              : "bg-blue-100 text-blue-800"
          }>
            {statusLabels[registrationStatus] || registrationStatus}
          </Badge>
        </div>
        {registrationStatus === "registered" && (
          <Button
            variant="outline"
            className="w-full text-red-600 border-red-200 hover:bg-red-50"
            onClick={handleWithdraw}
            disabled={loading}
          >
            {loading ? "..." : t("withdrawButton")}
          </Button>
        )}
        {registrationStatus === "registration_confirmed" && (
          <p className="text-sm text-muted-foreground">{t("confirmedNote")}</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t("yourEmail")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          defaultValue={session?.email || ""}
          readOnly={!!session?.email}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">{t("yourName")}</Label>
        <Input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={session?.name || ""}
          readOnly={!!session?.name}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">{t("notes")}</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>
      <Button
        type="submit"
        className="w-full bg-green-600 hover:bg-green-700"
        disabled={loading}
      >
        {loading ? "..." : t("registerButton")}
      </Button>
    </form>
  );
}
