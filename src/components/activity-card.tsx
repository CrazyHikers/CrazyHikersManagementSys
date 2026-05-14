import { useTranslations, useLocale } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  HeartMountainIcon,
  PlumBlossom,
  fontDisplayZh,
  m520Theme,
} from "@/components/events/matchmaking-520/theme";
import { MATCHMAKING_520_TEMPLATE } from "@/lib/events/matchmaking-520";

type ActivityCardProps = {
  id: string;
  title: string;
  description: string;
  coverImgUrl: string | null;
  date: string;
  deadline: string;
  capacity: number;
  currentRegistrations: number;
  maximumRegistration: number | null;
  submissionCount: number;
  managerNames: string;
  registered?: boolean;
  managing?: boolean;
  pendingInvitation?: boolean;
  sameDayConflict?: { activityId: string; title: string; role: "member" | "manager" };
  template?: string | null;
};

export function ActivityCard({
  id,
  title,
  description,
  coverImgUrl,
  date,
  deadline,
  capacity,
  currentRegistrations,
  maximumRegistration,
  submissionCount,
  managerNames,
  registered,
  managing,
  pendingInvitation,
  sameDayConflict,
  template,
}: ActivityCardProps) {
  const t = useTranslations("home");
  const locale = useLocale();
  const spotsLeft = capacity > 0 ? capacity - currentRegistrations : null;
  const showSubmissions = !!maximumRegistration && maximumRegistration > 0;
  // Only show the conflict state when the user isn't already involved with
  // this activity in another way (managing / invited / registered).
  const showConflict = !!sameDayConflict && !managing && !pendingInvitation && !registered;
  const isMatchmaking = template === MATCHMAKING_520_TEMPLATE;

  // Action button — same logic as before, but the matchmaking template
  // gets the dusty-rose gradient instead of the default green.
  const actionButton = managing ? (
    <Button size="sm" variant="outline" tabIndex={-1}>
      {t("managing")}
    </Button>
  ) : pendingInvitation ? (
    <Button size="sm" variant="outline" className="text-amber-700 border-amber-600" tabIndex={-1}>
      {t("pendingInvitation")}
    </Button>
  ) : registered ? (
    <Button
      size="sm"
      variant="outline"
      className={
        isMatchmaking
          ? "text-[#d4685e] border-[#d4685e]"
          : "text-green-700 border-green-600"
      }
      tabIndex={-1}
    >
      {t("registered")}
    </Button>
  ) : showConflict ? (
    <Button size="sm" variant="outline" className="text-red-700 border-red-600" tabIndex={-1}>
      {sameDayConflict!.role === "manager"
        ? t("sameDayManaging", { title: sameDayConflict!.title })
        : t("sameDayConfirmed", { title: sameDayConflict!.title })}
    </Button>
  ) : (
    <Button
      size="sm"
      className={
        isMatchmaking
          ? m520Theme.gradientCta
          : "bg-green-600 hover:bg-green-700"
      }
      tabIndex={-1}
    >
      {t("register")}
    </Button>
  );

  // Decorative poster shown in place of the cover image for matchmaking
  // events when the admin hasn't uploaded one. Keeps the card's overall
  // proportions and gives the event a strong visual hook in the list.
  const matchmakingPoster = (
    <div className="relative w-full h-full bg-[linear-gradient(135deg,#fde4d3_0%,#f8c6c2_50%,#e89898_100%)] flex items-center justify-center overflow-hidden">
      <PlumBlossom
        aria-hidden
        className="absolute top-3 left-3 h-7 w-7 text-[#fdf6ee]/60 rotate-12"
      />
      <PlumBlossom
        aria-hidden
        className="absolute bottom-3 right-3 h-6 w-6 text-[#fdf6ee]/50 -rotate-12"
      />
      <span
        aria-hidden
        className="absolute top-2 right-3 text-[10px] tracking-[0.3em] uppercase text-[#fdf6ee]/80"
      >
        5 · 20
      </span>
      <HeartMountainIcon className="h-20 w-24 text-[#fdf6ee] drop-shadow-[0_2px_8px_rgba(58,40,32,0.2)]" />
    </div>
  );

  const cardInner = (
    <Card
      className={
        isMatchmaking
          ? `relative overflow-hidden ring-1 ring-[#e8c8c0]/70 hover:ring-[#d4685e]/60 hover:shadow-lg transition-all cursor-pointer bg-[linear-gradient(180deg,#fdf6ee_0%,#fbeee2_100%)] dark:bg-stone-900/30`
          : "overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      }
    >
      {isMatchmaking && (
        <>
          {/* Soft halo ring */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-[#e89898]/40"
          />
          {/* Corner blossom */}
          <PlumBlossom
            aria-hidden
            className="absolute -top-2 -right-2 h-9 w-9 text-[#e89898]/40 rotate-12 pointer-events-none"
          />
          {/* "5·20 限定" angled banner */}
          <div className="absolute top-3 left-0 z-10 pointer-events-none">
            <span
              className={`inline-block ${m520Theme.gradientCta} text-[10px] tracking-[0.25em] uppercase px-3 py-1 rounded-r-full shadow-sm`}
            >
              5 · 20 限定
            </span>
          </div>
        </>
      )}

      <div className="flex flex-col sm:flex-row">
        {coverImgUrl ? (
          <div className="sm:w-48 h-40 sm:h-auto flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImgUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : isMatchmaking ? (
          <div className="sm:w-48 h-40 sm:h-auto flex-shrink-0">
            {matchmakingPoster}
          </div>
        ) : null}

        <div className="flex-1">
          <CardHeader className={`pb-2 ${isMatchmaking ? "pt-5" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <CardTitle
                className={
                  isMatchmaking
                    ? `${fontDisplayZh} text-xl leading-tight text-[#3a2820] dark:text-[#fdf6ee]`
                    : "text-lg leading-tight"
                }
              >
                {title}
              </CardTitle>
              {spotsLeft !== null && (
                <Badge
                  variant={spotsLeft > 0 ? "secondary" : "destructive"}
                  className={
                    isMatchmaking && spotsLeft > 0
                      ? "bg-[#fde4d3] text-[#d4685e] hover:bg-[#fde4d3]"
                      : ""
                  }
                >
                  {spotsLeft > 0
                    ? t("spotsLeft", { count: spotsLeft })
                    : t("spotsFull")}
                </Badge>
              )}
            </div>
            <CardDescription
              className={
                isMatchmaking
                  ? "line-clamp-2 text-[#6a5447] dark:text-[#d4c4b8]"
                  : "line-clamp-2"
              }
            >
              {description}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div
              className={`flex flex-col gap-1 text-sm mb-3 ${
                isMatchmaking
                  ? "text-[#6a5447] dark:text-[#d4c4b8]"
                  : "text-muted-foreground"
              }`}
            >
              <div>
                {t("activityDate")}:{" "}
                {new Date(date).toLocaleDateString(locale)}
              </div>
              <div>
                {t("deadline")}:{" "}
                {new Date(deadline).toLocaleDateString(locale)}
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
                  {t("formsSubmitted", { current: submissionCount, max: maximumRegistration! })}
                </div>
              )}
            </div>
            {actionButton}
          </CardContent>
        </div>
      </div>
    </Card>
  );

  return (
    <Link href={`/activities/${id}`} prefetch={false} className="block">
      {cardInner}
    </Link>
  );
}
