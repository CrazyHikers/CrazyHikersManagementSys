"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function RegistrationForm({ activityId }: { activityId: string }) {
  const t = useTranslations("activity");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      email: formData.get("email") as string,
      name: formData.get("name") as string,
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
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
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
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">{t("yourName")}</Label>
        <Input id="name" name="name" type="text" required />
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
