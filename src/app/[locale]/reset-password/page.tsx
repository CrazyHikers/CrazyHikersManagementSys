"use client";

import { useState, Suspense } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

function ResetPasswordForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const linkInvalid = !token || !email;

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src="/logo.jpg" alt="Crazy Hikers" className="h-20 mx-auto mb-2" />
          <CardTitle>{t("resetPasswordTitle")}</CardTitle>
          <CardDescription>{t("resetPasswordDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {linkInvalid ? (
            <div className="text-center text-red-600 py-4">{t("resetLinkInvalid")}</div>
          ) : done ? (
            <div className="text-center py-4">
              <div className="text-green-600 font-medium">{t("resetSuccess")}</div>
            </div>
          ) : (
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
              {error && (
                <div className="text-red-600 text-sm text-center">{error}</div>
              )}
              <Button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={loading}
              >
                {loading ? "..." : t("setPassword")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
