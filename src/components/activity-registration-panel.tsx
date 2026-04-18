"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RegistrationForm } from "@/components/registration-form";
import { useActivityStatus } from "@/components/activity-status-provider";

export function ActivityRegistrationPanel({
  activityId,
  qrCodeUrl,
  isOpen,
  isFull,
}: {
  activityId: string;
  qrCodeUrl: string | null;
  isOpen: boolean;
  isFull: boolean;
}) {
  const t = useTranslations("activity");
  const { data: session, status: sessionStatus } = useSession();
  const status = useActivityStatus();
  const [registrationStatus, setRegistrationStatus] = useState<string | null>(null);
  const [pendingInvitationToken, setPendingInvitationToken] = useState<string | null>(null);

  const email = session?.user?.email ?? null;
  const isManager = status.managing.has(activityId);

  useEffect(() => {
    if (!email || isManager) {
      setRegistrationStatus(null);
      setPendingInvitationToken(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      fetch(`/api/activities/${activityId}/register/status`)
        .then((r) => (r.ok ? r.json() : { status: null })),
      fetch(`/api/activities/${activityId}/my-invitation`)
        .then((r) => (r.ok ? r.json() : { token: null })),
    ])
      .then(([reg, inv]) => {
        if (cancelled) return;
        setRegistrationStatus(reg?.status ?? null);
        setPendingInvitationToken(inv?.token ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activityId, email, isManager]);

  const isConfirmed =
    registrationStatus === "registration_confirmed" ||
    registrationStatus === "attended";

  return (
    <>
      {isConfirmed && qrCodeUrl ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("qrCode")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">{t("qrCodeHelp")}</p>
            <img
              src={qrCodeUrl}
              alt={t("qrCode")}
              className="max-w-64 mx-auto rounded-lg"
            />
          </CardContent>
        </Card>
      ) : null}

      {isOpen && !isFull ? (
        sessionStatus === "loading" ? null : !email ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-4">{t("signInToRegister")}</p>
              <Link href="/signin">
                <Button className="bg-green-600 hover:bg-green-700">{t("signIn")}</Button>
              </Link>
            </CardContent>
          </Card>
        ) : isManager ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {t("youAreManaging")}
            </CardContent>
          </Card>
        ) : pendingInvitationToken ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("pendingComanagerInvitation")}</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-4">
                {t("pendingComanagerInvitationHelp")}
              </p>
              <Link href={`/invitations/comanager/${pendingInvitationToken}`}>
                <Button className="bg-green-600 hover:bg-green-700">
                  {t("respondToInvitation")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t("registrationForm")}</CardTitle>
            </CardHeader>
            <CardContent>
              <RegistrationForm
                activityId={activityId}
                session={{
                  name: session?.user?.name ?? null,
                  email,
                }}
              />
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t("registrationClosed")}
          </CardContent>
        </Card>
      )}
    </>
  );
}
