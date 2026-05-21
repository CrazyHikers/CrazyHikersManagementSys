"use client";

import { useTranslations, useLocale } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Subcomponents shared across activity-card variants. Each template's
// card composes from these so feature changes (new badge, new meta row)
// only have to be made in one place. Styling is controlled by passing
// className overrides — templates can re-skin without re-implementing
// the underlying logic.

export type CardActionState = {
  managing?: boolean;
  pendingInvitation?: boolean;
  registered?: boolean;
  sameDayConflict?: {
    activityId: string;
    title: string;
    role: "member" | "manager";
  };
};

export function CardActionButton({
  state,
  registeredOutlineClassName,
  registerClassName,
}: {
  state: CardActionState;
  registeredOutlineClassName?: string;
  registerClassName?: string;
}) {
  const t = useTranslations("home");
  const { managing, pendingInvitation, registered, sameDayConflict } = state;
  const showConflict =
    !!sameDayConflict && !managing && !pendingInvitation && !registered;

  if (managing) {
    return (
      <Button size="sm" variant="outline" tabIndex={-1}>
        {t("managing")}
      </Button>
    );
  }
  if (pendingInvitation) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="text-amber-700 border-amber-600"
        tabIndex={-1}
      >
        {t("pendingInvitation")}
      </Button>
    );
  }
  if (registered) {
    return (
      <Button
        size="sm"
        variant="outline"
        className={
          registeredOutlineClassName ?? "text-green-700 border-green-600"
        }
        tabIndex={-1}
      >
        {t("registered")}
      </Button>
    );
  }
  if (showConflict) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="text-red-700 border-red-600"
        tabIndex={-1}
      >
        {sameDayConflict!.role === "manager"
          ? t("sameDayManaging", { title: sameDayConflict!.title })
          : t("sameDayConfirmed", { title: sameDayConflict!.title })}
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      className={registerClassName ?? "bg-green-600 hover:bg-green-700"}
      tabIndex={-1}
    >
      {t("register")}
    </Button>
  );
}

export function CardSpotsLeftBadge({
  capacity,
  currentRegistrations,
  spotsLeftClassName,
}: {
  capacity: number;
  currentRegistrations: number;
  spotsLeftClassName?: string;
}) {
  const t = useTranslations("home");
  const spotsLeft = capacity > 0 ? capacity - currentRegistrations : null;
  if (spotsLeft === null) return null;
  return (
    <Badge
      variant={spotsLeft > 0 ? "secondary" : "destructive"}
      className={spotsLeft > 0 ? spotsLeftClassName : ""}
    >
      {spotsLeft > 0
        ? t("spotsLeft", { count: spotsLeft })
        : t("spotsFull")}
    </Badge>
  );
}

export function CardMetaLines({
  date,
  deadline,
  managerNames,
  capacity,
  currentRegistrations,
  maximumRegistration,
  submissionCount,
  className,
}: {
  date: string;
  deadline: string;
  managerNames: string;
  capacity: number;
  currentRegistrations: number;
  maximumRegistration: number | null;
  submissionCount: number;
  className?: string;
}) {
  const t = useTranslations("home");
  const locale = useLocale();
  const showSubmissions = !!maximumRegistration && maximumRegistration > 0;
  return (
    <div
      className={`flex flex-col gap-1 text-sm mb-3 ${
        className ?? "text-muted-foreground"
      }`}
    >
      <div>
        {t("activityDate")}: {new Date(date).toLocaleDateString(locale)}
      </div>
      <div>
        {t("deadline")}: {new Date(deadline).toLocaleDateString(locale)}
      </div>
      <div>
        {t("managers")}: {managerNames}
      </div>
      {capacity > 0 && (
        <div>
          {t("placesTaken", { current: currentRegistrations, max: capacity })}
        </div>
      )}
      {showSubmissions && (
        <div>
          {t("formsSubmitted", {
            current: submissionCount,
            max: maximumRegistration!,
          })}
        </div>
      )}
    </div>
  );
}
