"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Turnstile } from "@/components/turnstile";

export default function SignUpPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [inboundAttempt, setInboundAttempt] = useState<{
    address: string;
    requestCode: string;
    browserToken: string;
  } | null>(null);

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken("");
  }, []);

  useEffect(() => {
    if (!inboundAttempt) return;

    let stopped = false;
    const poll = async () => {
      try {
        const response = await fetch("/api/auth/signup/inbound-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestCode: inboundAttempt.requestCode,
            browserToken: inboundAttempt.browserToken,
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (stopped) return;
        if (result.status === "verified" && typeof result.setupPath === "string") {
          router.push(result.setupPath);
        } else if (result.status === "expired" || result.status === "not_found") {
          setInboundAttempt(null);
          setError(t("inboundExpired"));
        }
      } catch {
        // A transient polling failure should not discard the pending attempt.
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 5_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [inboundAttempt, router, t]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    // No users row is created here — the signup endpoint stores only a
    // verification_tokens row, and the user is created in the database
    // when they click the email link and set a password.
    const res = await fetch("/api/auth/signup", {
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

    const data = await res.json().catch(() => ({}));
    if (
      data.method === "inbound" &&
      typeof data.address === "string" &&
      typeof data.requestCode === "string" &&
      typeof data.browserToken === "string"
    ) {
      setInboundAttempt({
        address: data.address,
        requestCode: data.requestCode,
        browserToken: data.browserToken,
      });
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  const emailSubject = inboundAttempt
    ? `JOIN ${inboundAttempt.requestCode}`
    : "";
  const mailtoHref = inboundAttempt
    ? `mailto:${inboundAttempt.address}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(t("inboundMailBody"))}`
    : "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src="/logo.jpg" alt="Crazy Hikers" className="h-20 mx-auto mb-2" />
          <CardTitle>{t("signUpTitle")}</CardTitle>
          <CardDescription>{t("signUpDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {inboundAttempt ? (
            <div className="space-y-4 py-2">
              <div className="text-center">
                <div className="font-medium text-green-700">{t("inboundTitle")}</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("inboundInstructions")}
                </p>
              </div>
              <div className="rounded-md bg-muted p-3 text-sm">
                <div className="text-muted-foreground">{t("inboundSendTo")}</div>
                <div className="break-all font-mono font-medium">{inboundAttempt.address}</div>
                <div className="mt-3 text-muted-foreground">{t("inboundSubject")}</div>
                <div className="break-all font-mono font-medium">{emailSubject}</div>
              </div>
              <Button
                type="button"
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={() => {
                  window.location.href = mailtoHref;
                }}
              >
                {t("inboundOpenMail")}
              </Button>
              <p className="text-center text-sm text-muted-foreground">{t("inboundWaiting")}</p>
              {error && <div className="text-center text-sm text-red-600">{error}</div>}
            </div>
          ) : sent ? (
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
                <Link href="/signin" className="text-green-600 hover:underline">
                  {t("hasAccount")} {t("signIn")}
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
