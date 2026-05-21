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
  HangingLantern,
  PavilionLanternIcon,
  aud520Theme,
  fontDisplayAud,
} from "./theme";

// Decorative poster shown in place of the cover image when the admin
// hasn't uploaded one. Pairs visually with MatchmakingPoster — same
// dimensions and "5·20" banner placement — but in the audience-team
// celadon/twilight palette with hanging lanterns instead of plum
// blossoms.
function AudiencePoster() {
  return (
    <div className="relative w-full h-full bg-[linear-gradient(135deg,#fde4a3_0%,#f0a868_50%,#5a8a6e_100%)] flex items-center justify-center overflow-hidden">
      <span
        aria-hidden
        className="absolute top-1 left-3 aud520-sway origin-top text-[#fdf6ee]/70"
      >
        <HangingLantern className="h-9 w-6" />
      </span>
      <span
        aria-hidden
        className="absolute top-1 right-3 aud520-sway-slow origin-top text-[#fdf6ee]/70"
      >
        <HangingLantern className="h-9 w-6" />
      </span>
      <span
        aria-hidden
        className="absolute top-2 right-1/2 translate-x-1/2 text-[10px] tracking-[0.3em] uppercase text-[#fdf6ee]/85"
      >
        5 · 20
      </span>
      <PavilionLanternIcon className="h-20 w-24 text-[#fdf6ee] drop-shadow-[0_2px_8px_rgba(40,30,24,0.25)]" />
    </div>
  );
}

export function Audience520Card(props: ActivityCardProps) {
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
      <Card className="relative overflow-hidden ring-1 ring-[#c8d4c4]/70 hover:ring-[#5a8a6e]/60 hover:shadow-lg transition-all cursor-pointer bg-[linear-gradient(180deg,#fdf6ee_0%,#f1ece0_100%)] dark:bg-stone-900/30">
        {/* Soft halo ring */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-[#a8c0a0]/40"
        />
        {/* Corner lantern — small, swaying */}
        <span
          aria-hidden
          className="absolute -top-1 -right-1 aud520-sway-slow origin-top pointer-events-none"
        >
          <HangingLantern className="h-10 w-7" />
        </span>
        {/* "5·20 围观席" angled banner — green CTA gradient so it reads
            as the audience pair to matchmaking's red banner */}
        <div className="absolute top-3 left-0 z-10 pointer-events-none">
          <span
            className={`inline-block ${aud520Theme.gradientCta} text-[10px] tracking-[0.25em] uppercase px-3 py-1 rounded-r-full shadow-sm`}
          >
            5 · 20 围观席
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
              <AudiencePoster />
            )}
          </div>

          <div className="flex-1">
            <CardHeader className="pb-2 pt-5">
              <div className="flex items-start justify-between gap-2">
                <CardTitle
                  className={`${fontDisplayAud} text-xl leading-tight ${aud520Theme.ink}`}
                >
                  {title}
                </CardTitle>
                <CardSpotsLeftBadge
                  capacity={capacity}
                  currentRegistrations={currentRegistrations}
                  spotsLeftClassName="bg-[#e6efe1] text-[#3f6a52] hover:bg-[#e6efe1]"
                />
              </div>
              <CardDescription className={aud520Theme.inkSoft}>
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
                className="text-[#5a6a5e] dark:text-[#c8d4c4]"
              />
              <CardActionButton
                state={{ managing, pendingInvitation, registered, sameDayConflict }}
                registeredOutlineClassName="text-[#5a8a6e] border-[#5a8a6e]"
                registerClassName={aud520Theme.gradientCta}
              />
            </CardContent>
          </div>
        </div>
      </Card>
    </Link>
  );
}
