"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function SetPasswordPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Check if user is authenticated by hitting the set-password API
    // If not authenticated, it will return 401 and we redirect to signin
    fetch("/api/auth/set-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "" }) })
      .then((res) => {
        if (res.status === 401) {
          router.push("/signin");
        } else {
          // User is authenticated (400 = validation error means they're logged in)
          setReady(true);
        }
      })
      .catch(() => {
        setReady(true);
      });
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-500">...</div>
      </div>
    );
  }

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
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to set password");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src="/logo.jpg" alt="Crazy Hikers" className="h-20 mx-auto mb-2" />
          <CardTitle>{t("setPasswordTitle")}</CardTitle>
          <CardDescription>{t("setPasswordDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
