"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useActivityStatus } from "@/components/activity-status-provider";
import { Matchmaking520Wizard } from "./Matchmaking520Wizard";
import { m520Theme } from "./theme";
import type { Gender } from "@/lib/events/matchmaking-520";

type Props = {
  activityId: string;
  isOpen: boolean;
  isFull: boolean;
  publicUrlPrefix: string;
};

export function Matchmaking520RegistrationPanel({
  activityId,
  isOpen,
  isFull,
  publicUrlPrefix,
}: Props) {
  const tl = useTranslations("events.matchmaking520.landing");
  const ta = useTranslations("activity");
  const { data: session, status: sessionStatus } = useSession();
  const activityStatus = useActivityStatus();
  const [registrationStatus, setRegistrationStatus] = useState<string | null>(
    null
  );
  const [showWizard, setShowWizard] = useState(false);

  const email = session?.user?.email ?? null;
  const isManager = activityStatus.managing.has(activityId);

  useEffect(() => {
    if (!email || isManager) {
      setRegistrationStatus(null);
      return;
    }
    fetch(`/api/activities/${activityId}/register/status`)
      .then((r) => (r.ok ? r.json() : { status: null }))
      .then((d) => setRegistrationStatus(d?.status ?? null))
      .catch(() => {});
  }, [activityId, email, isManager]);

  function publicUrlFor(key: string): string {
    return `${publicUrlPrefix}/${key}`;
  }

  // CTA region
  if (!isOpen || isFull) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {isFull ? tl("ctaFull") : tl("ctaClosed")}
        </CardContent>
      </Card>
    );
  }
  if (sessionStatus === "loading") return null;
  if (!email) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground mb-4">{ta("signInToRegister")}</p>
          <Link href="/signin">
            <Button className={`${m520Theme.gradientCta} text-white`}>
              {tl("ctaSignIn")}
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }
  if (isManager) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {ta("youAreManaging")}
        </CardContent>
      </Card>
    );
  }
  if (registrationStatus) {
    return (
      <Card>
        <CardContent className="py-6 text-center space-y-2">
          <Badge
            className={
              registrationStatus === "registration_confirmed"
                ? "bg-green-100 text-green-800"
                : "bg-blue-100 text-blue-800"
            }
          >
            {registrationStatus === "registration_confirmed"
              ? ta("statusConfirmed")
              : ta("statusRegistered")}
          </Badge>
          <p className="text-sm text-muted-foreground">{tl("ctaRegistered")}</p>
        </CardContent>
      </Card>
    );
  }
  if (showWizard) {
    return (
      <Matchmaking520Wizard
        activityId={activityId}
        initialName={session?.user?.name ?? undefined}
        initialGender={
          (session?.user as { profile?: { gender?: Gender } })?.profile?.gender
        }
        publicUrlFor={publicUrlFor}
        onDone={() => {
          setShowWizard(false);
          setRegistrationStatus("registered");
        }}
      />
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{ta("registrationForm")}</CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <Button
          className={`${m520Theme.gradientCta} text-white text-lg px-8 py-6`}
          onClick={() => setShowWizard(true)}
        >
          {tl("cta")}
        </Button>
      </CardContent>
    </Card>
  );
}
