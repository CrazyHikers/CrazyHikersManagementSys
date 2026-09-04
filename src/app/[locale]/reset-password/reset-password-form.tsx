"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password.length < 8) {
      setError(t("passwordMinLength"));
      setLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setError(t("passwordsMustMatch"));
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || t("resetFailed"));
        setLoading(false);
        return;
      }
      setDone(true);
      setLoading(false);
      // Brief delay so the user reads the success message before redirect.
      setTimeout(() => router.push("/signin"), 1500);
    } catch {
      setError(t("resetFailed"));
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="py-4 text-center">
        <div className="font-medium text-green-600">{t("resetSuccess")}</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder={t("passwordPlaceholder")}
          required
          minLength={8}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder={t("confirmPasswordPlaceholder")}
          required
          minLength={8}
        />
      </div>
      {error && <div className="text-center text-sm text-red-600">{error}</div>}
      <Button
        type="submit"
        className="w-full bg-green-600 hover:bg-green-700"
        disabled={loading}
      >
        {loading ? "..." : t("setPassword")}
      </Button>
    </form>
  );
}
