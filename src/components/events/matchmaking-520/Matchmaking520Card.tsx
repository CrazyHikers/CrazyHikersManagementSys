"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { ActivityCardProps } from "@/components/activity-card/activity-card-types";
import {
  CardActionButton,
  CardMetaLines,
  CardSpotsLeftBadge,
} from "@/components/activity-card/parts";
import {
  HeartMountainIcon,
  PlumBlossom,
  fontDisplayZh,
  m520Theme,
} from "./theme";

// Decorative poster shown in place of the cover image when the admin
// hasn't uploaded one. Keeps the card's overall proportions and gives
// the event a strong visual hook in the list.
function MatchmakingPoster() {
  return (
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
}

export function Matchmaking520Card(props: ActivityCardProps) {
  const {
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
  } = props;

  return (
    <Link href={`/activities/${id}`} prefetch={false} className="block">
      <Card className="relative overflow-hidden ring-1 ring-[#e8c8c0]/70 hover:ring-[#d4685e]/60 hover:shadow-lg transition-all cursor-pointer bg-[linear-gradient(180deg,#fdf6ee_0%,#fbeee2_100%)] dark:bg-stone-900/30">
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

        <div className="flex flex-col sm:flex-row">
          <div className="sm:w-48 h-40 sm:h-auto flex-shrink-0">
            {coverImgUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={coverImgUrl}
                alt={title}
                className="w-full h-full object-cover"
              />
            ) : (
              <MatchmakingPoster />
            )}
          </div>

          <div className="flex-1">
            <CardHeader className="pb-2 pt-5">
              <div className="flex items-start justify-between gap-2">
                <CardTitle
                  className={`${fontDisplayZh} text-xl leading-tight text-[#3a2820] dark:text-[#fdf6ee]`}
                >
                  {title}
                </CardTitle>
                <CardSpotsLeftBadge
                  capacity={capacity}
                  currentRegistrations={currentRegistrations}
                  spotsLeftClassName="bg-[#fde4d3] text-[#d4685e] hover:bg-[#fde4d3]"
                />
              </div>
              <CardDescription className="line-clamp-2 text-[#6a5447] dark:text-[#d4c4b8]">
                {description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <CardMetaLines
                date={date}
                deadline={deadline}
                managerNames={managerNames}
                capacity={capacity}
                currentRegistrations={currentRegistrations}
                maximumRegistration={maximumRegistration}
                submissionCount={submissionCount}
                className="text-[#6a5447] dark:text-[#d4c4b8]"
              />
              <CardActionButton
                state={{ managing, pendingInvitation, registered, sameDayConflict }}
                registeredOutlineClassName="text-[#d4685e] border-[#d4685e]"
                registerClassName={m520Theme.gradientCta}
              />
            </CardContent>
          </div>
        </div>
      </Card>
    </Link>
  );
}
