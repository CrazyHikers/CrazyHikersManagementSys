"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useActivityStatus } from "@/components/activity-status-provider";
import { Matchmaking520Wizard } from "./Matchmaking520Wizard";
import { PlumBlossom, fontDisplayZh, m520Theme } from "./theme";
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
    if (!email || isManager) return;
    let cancelled = false;
    fetch(`/api/activities/${activityId}/register/status`)
      .then((r) => (r.ok ? r.json() : { status: null }))
      .then((d) => {
        if (!cancelled) setRegistrationStatus(d?.status ?? null);
      })
      .catch(() => {});
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
  if (registrationStatus) {
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
