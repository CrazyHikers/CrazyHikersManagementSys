"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useActivityStatus } from "@/components/activity-status-provider";
import { WaiverSignInline } from "@/components/waiver-sign-inline";
import { Audience520Form } from "./Audience520Form";
import { SuccessScreen } from "./SuccessScreen";
import { HangingLantern, aud520Theme, fontDisplayAud } from "./theme";
import type { Gender } from "@/lib/events/matchmaking-520";

type Props = {
  activityId: string;
  isOpen: boolean;
  isFull: boolean;
};

// Hoisted outside the panel so React doesn't see a new component
// identity on every render — that would reset the children's state
// each time and trips the react-hooks/static-components rule.
function ShellCard({ children }: { children: React.ReactNode }) {
  return (
    <Card
      className={`${aud520Theme.cardAccent} shadow-sm relative overflow-hidden`}
    >
      <span className="absolute -top-1 left-4 aud520-sway origin-top">
        <HangingLantern className="h-9 w-6" />
      </span>
      <span className="absolute -top-1 right-4 aud520-sway-slow origin-top">
        <HangingLantern className="h-9 w-6" />
      </span>
      <CardContent className="py-12 px-6 text-center">{children}</CardContent>
    </Card>
  );
}

export function Audience520RegistrationPanel({
  activityId,
  isOpen,
  isFull,
}: Props) {
  const tl = useTranslations("events.audience520.landing");
  const ta = useTranslations("activity");
  const { data: session, status: sessionStatus } = useSession();
  const activityStatus = useActivityStatus();
  const [registrationStatus, setRegistrationStatus] = useState<string | null>(
    null
  );
  const [showForm, setShowForm] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [needsWaiver, setNeedsWaiver] = useState(false);
  const [waiverValidityDays, setWaiverValidityDays] = useState(365);
  const [preflightChecked, setPreflightChecked] = useState(false);

  const email = session?.user?.email ?? null;
  const isManager = activityStatus.managing.has(activityId);

  useEffect(() => {
    if (!email || isManager) {
      setPreflightChecked(true);
      return;
    }
    let cancelled = false;
    setPreflightChecked(false);
    Promise.all([
      fetch(`/api/activities/${activityId}/register/status`)
        .then((r) => (r.ok ? r.json() : { status: null })),
      fetch("/api/users/me/profile/status")
        .then((r) => (r.ok ? r.json() : { isComplete: true })),
      fetch("/api/users/me/waivers/status")
        .then((r) => (r.ok ? r.json() : { hasValidWaiver: true })),
    ])
      .then(([reg, profile, waiver]) => {
        if (cancelled) return;
        setRegistrationStatus(reg?.status ?? null);
        setNeedsProfile(!profile?.isComplete);
        setNeedsWaiver(!waiver?.hasValidWaiver);
        if (waiver?.validityDays) setWaiverValidityDays(waiver.validityDays);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPreflightChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [activityId, email, isManager]);

  if (!isOpen || isFull) {
    return (
      <ShellCard>
        <p
          className={`${fontDisplayAud} text-lg ${aud520Theme.inkSoft}`}
        >
          {isFull ? tl("ctaFull") : tl("ctaClosed")}
        </p>
      </ShellCard>
    );
  }
  if (sessionStatus === "loading") return null;
  if (!email) {
    return (
      <ShellCard>
        <p className={`${aud520Theme.inkSoft} mb-5`}>
          {ta("signInToRegister")}
        </p>
        <Link href="/signin">
          <Button className={`${aud520Theme.gradientCta} px-6`}>
            {tl("ctaSignIn")}
          </Button>
        </Link>
      </ShellCard>
    );
  }
  if (isManager) {
    return (
      <ShellCard>
        <p className={aud520Theme.inkSoft}>{ta("youAreManaging")}</p>
      </ShellCard>
    );
  }
  if (!preflightChecked) return null;
  if (!registrationStatus && needsProfile) {
    return (
      <ShellCard>
        <p className={`${aud520Theme.inkSoft} mb-5`}>
          {ta("profileRequired")}
        </p>
        <Link href="/dashboard/my-profile">
          <Button className={`${aud520Theme.gradientCta} px-6`}>
            {ta("completeProfile")}
          </Button>
        </Link>
      </ShellCard>
    );
  }
  if (!registrationStatus && needsWaiver) {
    return (
      <ShellCard>
        <p className={`${aud520Theme.inkSoft} mb-5`}>
          {ta("waiverRequired")}
        </p>
        <div className="text-left">
          <WaiverSignInline
            onSigned={() => setNeedsWaiver(false)}
            validityDays={waiverValidityDays}
          />
        </div>
      </ShellCard>
    );
  }
  if (registrationStatus) {
    if (showForm) {
      // After successful registration the form switches into "done" mode;
      // we render the success screen until the user dismisses it.
      return <SuccessScreen onClose={() => setShowForm(false)} />;
    }
    return (
      <ShellCard>
        <div className="flex flex-col items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#5a8a6e]/15 text-[#c84840]">
            <span className="inline-block h-3 w-3 rounded-full bg-[#c84840]" />
          </span>
          <Badge
            className={
              registrationStatus === "registration_confirmed"
                ? "bg-[#5a8a6e] text-[#fdf6ee] hover:bg-[#5a8a6e]"
                : "bg-[#c84840] text-[#fdf6ee] hover:bg-[#c84840]"
            }
          >
            {registrationStatus === "registration_confirmed"
              ? ta("statusConfirmed")
              : ta("statusRegistered")}
          </Badge>
          <p
            className={`${fontDisplayAud} text-base ${aud520Theme.ink}`}
          >
            {tl("ctaRegistered")}
          </p>
        </div>
      </ShellCard>
    );
  }
  if (showForm) {
    return (
      <Audience520Form
        activityId={activityId}
        initialName={session?.user?.name ?? undefined}
        initialGender={
          (session?.user as { profile?: { gender?: Gender } })?.profile?.gender
        }
        onDone={() => {
          setRegistrationStatus("registered");
        }}
      />
    );
  }
  return (
    <ShellCard>
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-3 text-[#c84840]">
          <span className="inline-block h-2 w-2 rounded-full bg-[#c84840]" />
          <span
            className={`${fontDisplayAud} text-lg ${aud520Theme.ink}`}
          >
            {ta("registrationForm")}
          </span>
          <span className="inline-block h-2 w-2 rounded-full bg-[#c84840]" />
        </div>
        <Button
          className={`${aud520Theme.gradientCta} text-lg px-10 py-6 rounded-full`}
          onClick={() => setShowForm(true)}
        >
          {tl("cta")}
        </Button>
      </div>
    </ShellCard>
  );
}
