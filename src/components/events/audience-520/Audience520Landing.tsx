import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { getPublicUrl } from "@/lib/r2";
import {
  FloatingFireflies,
  HangingLantern,
  LanternGarland,
  PaperGrain,
  PavilionLanternIcon,
  aud520Theme,
  fontDisplayAud,
} from "./theme";
import { Audience520RegistrationPanel } from "./Audience520RegistrationPanel";
import { HikingDetailsSection } from "@/components/events/HikingDetailsSection";

// Loose-typed payload — matches what activity detail page sends in.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Activity = any;

export async function Audience520Landing({
  activity,
  locale,
  isOpen,
  isFull,
}: {
  activity: Activity;
  locale: string;
  isOpen: boolean;
  isFull: boolean;
}) {
  const t = await getTranslations("events.audience520.landing");
  const ta = await getTranslations("activity");
  const meta = (activity.metadata as Record<string, unknown> | null) ?? {};
  const privacyNotice =
    typeof meta.privacyNotice === "string" ? meta.privacyNotice : "";
  const activityDate = new Date(activity.date);
  const activityDeadline = new Date(activity.deadline);

  const managers = activity.activityManagers
    .filter((am: { role: string }) => am.role === "manager")
    .map(
      (am: {
        user: { name: string; managerProfile: { tag: string | null } | null };
      }) => am.user.managerProfile?.tag || am.user.name
    );

  return (
    <main className={`flex-1 relative ${aud520Theme.pageBg}`}>
      <PaperGrain className="z-0" opacity={0.07} />

      {/* Hero ---------------------------------------------------------- */}
      <section
        className={`relative overflow-hidden ${aud520Theme.heroGradient}`}
      >
        <FloatingFireflies count={14} className="opacity-95" />
        <PaperGrain opacity={0.1} />

        {/* Corner brackets — paper-invitation feel, mirrors matchmaking */}
        <span
          aria-hidden
          className="absolute top-6 left-6 h-12 w-12 border-l-2 border-t-2 border-[#fdf6ee]/70"
        />
        <span
          aria-hidden
          className="absolute top-6 right-6 h-12 w-12 border-r-2 border-t-2 border-[#fdf6ee]/70"
        />
        <span
          aria-hidden
          className="absolute bottom-6 left-6 h-12 w-12 border-l-2 border-b-2 border-[#fdf6ee]/70"
        />
        <span
          aria-hidden
          className="absolute bottom-6 right-6 h-12 w-12 border-r-2 border-b-2 border-[#fdf6ee]/70"
        />

        {/* Lantern garland strung across the top of the hero */}
        <LanternGarland
          count={9}
          className="absolute top-0 left-0 right-0 h-14 px-10"
        />

        <div className="relative container mx-auto px-6 pt-28 pb-24 max-w-3xl text-center text-[#fdf6ee]">
          <div className="flex justify-center mb-6">
            <PavilionLanternIcon className="h-24 w-28 text-[#fdf6ee] drop-shadow-[0_4px_12px_rgba(40,30,24,0.4)]" />
          </div>

          <div className="inline-flex items-center gap-4 mb-5">
            <span className="h-px w-12 bg-[#fdf6ee]/60" />
            <span className="text-xs tracking-[0.4em] uppercase">
              {t("subtitle")}
            </span>
            <span className="h-px w-12 bg-[#fdf6ee]/60" />
          </div>

          <h1
            className={`${fontDisplayAud} text-5xl md:text-6xl font-medium mb-4 drop-shadow-[0_2px_8px_rgba(40,30,24,0.4)]`}
          >
            {t("title")}
          </h1>

          <p className="mt-6 max-w-xl mx-auto text-[#fdf6ee]/90 leading-relaxed">
            {t("intro")}
          </p>
        </div>
      </section>

      {/* Body --------------------------------------------------------- */}
      <div className="relative container mx-auto px-4 py-12 max-w-3xl space-y-8">
        {/* Privacy notice as a folded paper note */}
        {privacyNotice && (
          <Card
            className={`relative overflow-hidden ${aud520Theme.cardAccent} shadow-sm`}
          >
            <span className="absolute -top-1 right-4 aud520-sway-slow origin-top">
              <HangingLantern className="h-10 w-7" />
            </span>
            <CardContent className="pt-5 pb-5 pl-6">
              <div className="flex items-baseline gap-3 mb-2">
                <span
                  className={`${fontDisplayAud} text-base text-[#5a8a6e]`}
                >
                  {t("privacyTitle")}
                </span>
                <span className="h-px flex-1 bg-[#5a8a6e]/20" />
              </div>
              <p
                className={`text-sm leading-relaxed whitespace-pre-line ${aud520Theme.inkSoft}`}
              >
                {privacyNotice}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Cover */}
        {activity.coverImgId && (
          <div className="rounded-xl overflow-hidden ring-1 ring-[#c8d4c4]/60 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getPublicUrl(activity.coverImgId)}
              alt={activity.title}
              className="w-full max-h-80 object-cover"
            />
          </div>
        )}

        {/* Title + description */}
        <div className="text-center space-y-3">
          <h2
            className={`${fontDisplayAud} text-3xl md:text-4xl ${aud520Theme.ink}`}
          >
            {activity.title}
          </h2>
          <div className="flex justify-center items-center gap-3">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#5a8a6e]/60" />
            <span
              className={`text-xs tracking-[0.3em] uppercase ${aud520Theme.inkSoft}`}
            >
              {activity.status === "open" ? t("subtitle") : activity.status}
            </span>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#5a8a6e]/60" />
          </div>
          <p
            className={`text-base leading-relaxed whitespace-pre-wrap mx-auto max-w-xl ${aud520Theme.inkSoft}`}
          >
            {activity.description}
          </p>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#c8d4c4]/60 rounded-xl overflow-hidden ring-1 ring-[#c8d4c4]/60">
          {[
            {
              label: ta("date"),
              value: activityDate.toLocaleDateString(locale),
            },
            {
              label: ta("deadline"),
              value: activityDeadline.toLocaleString(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            },
            {
              label: ta("capacity"),
              value: `${activity._count.registrations}${activity.capacity > 0 ? ` / ${activity.capacity}` : ""}`,
            },
            {
              label: ta("manager"),
              value: managers.join(", ") || "—",
            },
          ].map((it) => (
            <div
              key={it.label}
              className="bg-[#fdf6ee]/80 dark:bg-stone-900/40 px-4 py-3"
            >
              <div
                className={`text-[10px] tracking-[0.25em] uppercase ${aud520Theme.inkSoft}`}
              >
                {it.label}
              </div>
              <div
                className={`mt-1 truncate text-base ${aud520Theme.ink} ${fontDisplayAud}`}
              >
                {it.value}
              </div>
            </div>
          ))}
        </div>

        {/* Line info — route / elevation / difficulty from metadata */}
        <HikingDetailsSection
          metadata={activity.metadata}
          cardClassName={`${aud520Theme.cardAccent} shadow-sm`}
          headingClassName={`${fontDisplayAud} text-base text-[#5a8a6e]`}
          dividerClassName="bg-[#5a8a6e]/20"
          labelClassName={aud520Theme.inkSoft}
          valueClassName={`text-base ${aud520Theme.ink} ${fontDisplayAud}`}
        />

        {/* Steps as a three-lantern timeline */}
        <Card className={`${aud520Theme.cardAccent} shadow-sm`}>
          <CardContent className="pt-6 pb-6">
            <div className="flex items-baseline gap-3 mb-5">
              <span
                className={`${fontDisplayAud} text-base text-[#5a8a6e]`}
              >
                {t("stepsTitle")}
              </span>
              <span className="h-px flex-1 bg-[#5a8a6e]/20" />
            </div>
            <ol className="grid grid-cols-1 sm:grid-cols-3 gap-6 relative">
              <span
                aria-hidden
                className="hidden sm:block absolute top-5 left-[16%] right-[16%] h-px bg-[#a8c0a0]/40"
              />
              {[1, 2, 3].map((n) => (
                <li
                  key={n}
                  className="relative flex flex-col items-center text-center px-2"
                >
                  <span
                    className={
                      n === 2
                        ? "aud520-sway-slow origin-top mb-3"
                        : "aud520-sway origin-top mb-3"
                    }
                  >
                    <HangingLantern className="h-10 w-7" />
                  </span>
                  <div
                    className={`${fontDisplayAud} text-base ${aud520Theme.ink} mb-1`}
                  >
                    {t(`step${n}Title`)}
                  </div>
                  <div
                    className={`text-sm leading-relaxed ${aud520Theme.inkSoft}`}
                  >
                    {t(`step${n}Body`)}
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Registration */}
        <Audience520RegistrationPanel
          activityId={activity.id}
          isOpen={isOpen}
          isFull={isFull}
        />
      </div>
    </main>
  );
}
