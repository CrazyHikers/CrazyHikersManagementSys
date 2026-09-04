"use client";

import { useState, useCallback, useRef } from "react";
import { signIn } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";

export default function SignInPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileHandle>(null);

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken("");
  }, []);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const result = await signIn("credentials", {
        email,
        password,
        turnstileToken,
        redirect: false,
      });

      if (!result || result.error) {
        if (result?.error === "CredentialsSignin") {
          setError(
            result.code === "turnstile_verification_failed"
              ? t("turnstileError")
              : t("invalidCredentials")
          );
        } else {
          setError(t("signInUnavailable"));
        }
        turnstileRef.current?.reset();
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError(t("signInUnavailable"));
      turnstileRef.current?.reset();
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    // The reset flow handles its own Turnstile verification server-side and
    // doesn't go through Auth.js's email magic-link callback (which fails
    // to issue a JWT cookie under JWT session strategy).
    const res = await fetch("/api/auth/request-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, turnstileToken, locale }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || t("turnstileError"));
      setLoading(false);
      return;
    }

    setForgotSent(true);
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src="/logo.jpg" alt="Crazy Hikers" className="h-20 mx-auto mb-2" />
          <CardTitle>
            {forgotMode ? t("forgotPasswordTitle") : t("signInTitle")}
          </CardTitle>
          <CardDescription>
            {forgotMode ? t("forgotPasswordDescription") : t("signInDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {forgotSent ? (
            <div className="text-center py-4">
              <div className="text-green-600 font-medium">
                {t("forgotPasswordSent")}
              </div>
            </div>
          ) : forgotMode ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
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
                ref={turnstileRef}
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
                {loading ? "..." : t("sendResetLink")}
              </Button>
              <div className="text-center text-sm">
                <button
                  type="button"
                  className="text-green-600 hover:underline"
                  onClick={() => {
                    setForgotMode(false);
                    setError("");
                  }}
                >
                  {t("backToSignIn")}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignIn} className="space-y-4">
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
              <div className="space-y-2">
                <Label htmlFor="password">{t("password")}</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder={t("passwordPlaceholder")}
                  required
                />
              </div>
              <Turnstile
                ref={turnstileRef}
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
                {loading ? "..." : t("signIn")}
              </Button>
              <div className="flex justify-between text-sm">
                <button
                  type="button"
                  className="text-green-600 hover:underline"
                  onClick={() => {
                    setForgotMode(true);
                    setError("");
                  }}
                >
                  {t("forgotPassword")}
                </button>
                <Link href="/signup" className="text-green-600 hover:underline">
                  {t("noAccount")} {t("signUp")}
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
