"use client";

import { useState, useCallback } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Turnstile } from "@/components/turnstile";

export default function SignUpPage() {
  const t = useTranslations("auth");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken("");
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    // Verify Turnstile first
    const verifyRes = await fetch("/api/auth/verify-turnstile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turnstileToken }),
    });

    if (!verifyRes.ok) {
      setError(t("turnstileError"));
      setLoading(false);
      return;
    }

    await signIn("email", {
      email,
      redirect: false,
      callbackUrl: "/set-password",
    });

    setSent(true);
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src="/logo.jpg" alt="Crazy Hikers" className="h-20 mx-auto mb-2" />
          <CardTitle>{t("signUpTitle")}</CardTitle>
          <CardDescription>{t("signUpDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-center py-4">
              <div className="text-green-600 font-medium">
                {t("checkEmail")}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("emailPlaceholder")}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder={t("emailPlaceholder")}
                  required
                />
              </div>
              <Turnstile
                onVerify={handleTurnstileVerify}
                onExpire={handleTurnstileExpire}
              />
              {error && (
                <div className="text-red-600 text-sm text-center">{error}</div>
              )}
              <Button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={loading || !turnstileToken}
              >
                {loading ? "..." : t("sendMagicLink")}
              </Button>
              <div className="text-center text-sm">
                <a href="/signin" className="text-green-600 hover:underline">
                  {t("hasAccount")} {t("signIn")}
                </a>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
