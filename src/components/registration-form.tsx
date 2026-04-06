"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { WaiverSignInline } from "@/components/waiver-sign-inline";

type SessionUser = {
  name?: string | null;
  email?: string | null;
} | null;

const cameraEquipmentOptions = ["微单或单反", "无人机", "运动相机", "其他"];

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
  const [needsWaiver, setNeedsWaiver] = useState(false);
  const [waiverValidityDays, setWaiverValidityDays] = useState(365);

  // Per-registration form state
  const [transportTicket, setTransportTicket] = useState("");
  const [departureCity, setDepartureCity] = useState("");
  const [cameraEquipment, setCameraEquipment] = useState<string[]>([]);
  const [willPostSocialMedia, setWillPostSocialMedia] = useState("");
  const [willingToBePhotographed, setWillingToBePhotographed] = useState("");

  // Check registration status and waiver status
  useEffect(() => {
    if (!session?.email) return;
    Promise.all([
      fetch(`/api/activities/${activityId}/register/status`)
        .then((res) => res.json())
        .then((data) => {
          if (data.status) setRegistrationStatus(data.status);
        }),
      fetch("/api/users/me/waivers/status")
        .then((res) => res.json())
        .then((data) => {
          if (!data.hasValidWaiver) setNeedsWaiver(true);
          if (data.validityDays) setWaiverValidityDays(data.validityDays);
        }),
    ])
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [activityId, session?.email]);

  function toggleCameraEquipment(opt: string, checked: boolean) {
    setCameraEquipment((prev) =>
      checked ? [...prev, opt] : prev.filter((x) => x !== opt)
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const data = {
      email: (fd.get("email") as string) || session?.email || "",
      name: (fd.get("name") as string) || session?.name || "",
      notes: fd.get("notes") as string,
      formData: {
        transportTicket: transportTicket || undefined,
        departureCity: departureCity || undefined,
        cameraEquipment: cameraEquipment.length > 0 ? cameraEquipment : undefined,
        willPostSocialMedia: willPostSocialMedia === "yes" ? true : willPostSocialMedia === "no" ? false : undefined,
        willingToBePhotographed: willingToBePhotographed === "yes" ? true : willingToBePhotographed === "no" ? false : undefined,
        confirmInfo: fd.get("confirmInfo") === "on",
      },
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

  // Needs waiver — show inline signing before registration
  if (needsWaiver && !registrationStatus) {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
          {t("waiverRequired")}
        </div>
        <WaiverSignInline
          onSigned={() => setNeedsWaiver(false)}
          validityDays={waiverValidityDays}
        />
      </div>
    );
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

      {/* Per-registration fields */}
      <div className="border-t pt-4 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">{t("additionalInfo")}</h3>

        <div className="space-y-2">
          <Label htmlFor="transportTicket">{t("transportTicket")}</Label>
          <Input
            id="transportTicket"
            value={transportTicket}
            onChange={(e) => setTransportTicket(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="departureCity">{t("departureCity")}</Label>
          <Input
            id="departureCity"
            value={departureCity}
            onChange={(e) => setDepartureCity(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("cameraEquipment")}</Label>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {cameraEquipmentOptions.map((opt) => (
              <label key={opt} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={cameraEquipment.includes(opt)}
                  onChange={(e) => toggleCameraEquipment(opt, e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                {opt}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("willPostSocialMedia")}</Label>
          <Select value={willPostSocialMedia} onValueChange={(val) => setWillPostSocialMedia(val || "")}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">{t("yes")}</SelectItem>
              <SelectItem value="no">{t("no")}</SelectItem>
            </SelectContent>
          </Select>
        </div>


        <div className="space-y-2">
          <Label>{t("willingToBePhotographed")}</Label>
          <Select value={willingToBePhotographed} onValueChange={(val) => setWillingToBePhotographed(val || "")}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">{t("willing")}</SelectItem>
              <SelectItem value="no">{t("notWilling")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Confirmation */}
      <div className="border-t pt-4 space-y-3">
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            id="confirmInfo"
            name="confirmInfo"
            required
            className="mt-1 h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor="confirmInfo" className="text-sm font-normal leading-snug">
            {t("confirmInfo")}
          </Label>
        </div>
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
