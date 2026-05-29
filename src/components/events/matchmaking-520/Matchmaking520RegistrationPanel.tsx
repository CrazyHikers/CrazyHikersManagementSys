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
import { Matchmaking520Wizard } from "./Matchmaking520Wizard";
import { PlumBlossom, fontDisplayZh, m520Theme } from "./theme";
import type { Gender } from "@/lib/events/matchmaking-520";

type Props = {
  activityId: string;
  isOpen: boolean;
  isFull: boolean;
  publicUrlPrefix: string;
  qrCodeUrl: string | null;
};

export function Matchmaking520RegistrationPanel({
  activityId,
  isOpen,
  isFull,
  publicUrlPrefix,
  qrCodeUrl,
}: Props) {
  const tl = useTranslations("events.matchmaking520.landing");
  const ta = useTranslations("activity");
  const { data: session, status: sessionStatus } = useSession();
  const activityStatus = useActivityStatus();
  const [registrationStatus, setRegistrationStatus] = useState<string | null>(
    null
  );
  const [showWizard, setShowWizard] = useState(false);
  // Preflight: check profile + waiver completeness BEFORE letting the
  // user start the 20-question wizard. Filling out a long form only to
  // be rejected on submit because of missing profile/waiver is exactly
  // the frustration this gates against.
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

  function publicUrlFor(key: string): string {
    return `${publicUrlPrefix}/${key}`;
  }

  // Shared empty-state shell — paper-card look matching the landing
  function ShellCard({ children }: { children: React.ReactNode }) {
    return (
      <Card
        className={`${m520Theme.cardAccent} shadow-sm relative overflow-hidden`}
      >
        <PlumBlossom
          aria-hidden
          className="absolute -top-3 -right-3 h-10 w-10 text-[#e89898]/25 rotate-12"
        />
        <CardContent className="py-8 text-center">{children}</CardContent>
      </Card>
    );
  }

  // CTA region
  if (!isOpen || isFull) {
    return (
      <ShellCard>
        <p className={`${fontDisplayZh} text-lg text-[#6a5447] dark:text-[#d4c4b8]`}>
          {isFull ? tl("ctaFull") : tl("ctaClosed")}
        </p>
      </ShellCard>
    );
  }
  if (sessionStatus === "loading") return null;
  if (!email) {
    return (
      <ShellCard>
        <p className="text-[#6a5447] dark:text-[#d4c4b8] mb-5">
          {ta("signInToRegister")}
        </p>
        <Link href="/signin">
          <Button className={`${m520Theme.gradientCta} px-6`}>
            {tl("ctaSignIn")}
          </Button>
        </Link>
      </ShellCard>
    );
  }
  if (isManager) {
    return (
      <ShellCard>
        <p className="text-[#6a5447] dark:text-[#d4c4b8]">
          {ta("youAreManaging")}
        </p>
      </ShellCard>
    );
  }
  // Still resolving preflight checks — don't render any state yet to
  // avoid flashing the wrong gate.
  if (!preflightChecked) return null;
  // Profile gate — must come BEFORE the wizard CTA. Already-registered
  // users skip this entirely (handled below).
  if (!registrationStatus && needsProfile) {
    return (
      <ShellCard>
        <p className="text-[#6a5447] dark:text-[#d4c4b8] mb-5">
          {ta("profileRequired")}
        </p>
        <Link href="/dashboard/my-profile">
          <Button className={`${m520Theme.gradientCta} px-6`}>
            {ta("completeProfile")}
          </Button>
        </Link>
      </ShellCard>
    );
  }
  // Waiver gate — same reasoning; inline signing keeps users on the
  // page so they can come back to the wizard immediately.
  if (!registrationStatus && needsWaiver) {
    return (
      <ShellCard>
        <p className="text-[#6a5447] dark:text-[#d4c4b8] mb-5">
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
    const isConfirmed =
      registrationStatus === "registration_confirmed" ||
      registrationStatus === "attended";
    return (
      <ShellCard>
        <div className="flex flex-col items-center gap-3">
          <PlumBlossom className="h-8 w-8 text-[#d4685e]" />
          <Badge
            className={
              registrationStatus === "registration_confirmed"
                ? "bg-[#7a8a6e] text-[#fdf6ee] hover:bg-[#7a8a6e]"
                : "bg-[#d4685e] text-[#fdf6ee] hover:bg-[#d4685e]"
            }
          >
            {registrationStatus === "registration_confirmed"
              ? ta("statusConfirmed")
              : ta("statusRegistered")}
          </Badge>
          <p
            className={`${fontDisplayZh} text-base text-[#3a2820] dark:text-[#fdf6ee]`}
          >
            {tl("ctaRegistered")}
          </p>
          {isConfirmed && qrCodeUrl ? (
            <div className="mt-4 w-full border-t border-[#e8c8c0]/60 pt-4">
              <p
                className={`${fontDisplayZh} text-base text-[#d4685e] mb-2`}
              >
                {ta("qrCode")}
              </p>
              <p className="text-sm text-[#6a5447] dark:text-[#d4c4b8] mb-3">
                {ta("qrCodeHelp")}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCodeUrl}
                alt={ta("qrCode")}
                className="max-w-64 mx-auto rounded-lg"
              />
            </div>
          ) : null}
        </div>
      </ShellCard>
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
    <ShellCard>
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-3 text-[#d4685e]">
          <PlumBlossom className="h-5 w-5" />
          <span
            className={`${fontDisplayZh} text-lg text-[#3a2820] dark:text-[#fdf6ee]`}
          >
            {ta("registrationForm")}
          </span>
          <PlumBlossom className="h-5 w-5" />
        </div>
        <Button
          className={`${m520Theme.gradientCta} text-lg px-10 py-6 rounded-full`}
          onClick={() => setShowWizard(true)}
        >
          {tl("cta")}
        </Button>
      </div>
    </ShellCard>
  );
}
