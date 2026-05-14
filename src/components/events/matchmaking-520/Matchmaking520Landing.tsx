import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { getPublicUrl } from "@/lib/r2";
import {
  FloatingPetals,
  HeartMountainIcon,
  PaperGrain,
  PlumBlossom,
  fontDisplayZh,
  m520Theme,
} from "./theme";
import { Matchmaking520RegistrationPanel } from "./Matchmaking520RegistrationPanel";

// Activity payload shape matches what the parent activity page passes from
// Prisma — kept loose to avoid duplicating the include shape here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Activity = any;

export async function Matchmaking520Landing({
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
  const t = await getTranslations("events.matchmaking520.landing");
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
    <main className={`flex-1 relative ${m520Theme.pageBg}`}>
      <PaperGrain className="z-0" opacity={0.07} />

      {/* Hero ---------------------------------------------------------- */}
      <section
        className={`relative overflow-hidden ${m520Theme.heroGradient}`}
      >
        <FloatingPetals count={11} className="opacity-90" />
        <PaperGrain opacity={0.12} />

        {/* Decorative corner brackets evoke a paper invitation */}
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

        <div className="relative container mx-auto px-6 py-24 max-w-3xl text-center text-[#fdf6ee]">
          <div className="flex justify-center mb-6">
            <HeartMountainIcon className="h-24 w-28 text-[#fdf6ee] drop-shadow-[0_4px_12px_rgba(58,40,32,0.25)]" />
          </div>

          {/* Vertical date stamp + horizontal title */}
          <div className="inline-flex items-center gap-4 mb-5">
            <span className="h-px w-12 bg-[#fdf6ee]/60" />
            <span className="text-xs tracking-[0.4em] uppercase">
              {t("subtitle")}
            </span>
            <span className="h-px w-12 bg-[#fdf6ee]/60" />
          </div>

          <h1
            className={`${fontDisplayZh} text-5xl md:text-6xl font-medium mb-4 drop-shadow-[0_2px_8px_rgba(58,40,32,0.25)]`}
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
            className={`relative overflow-hidden ${m520Theme.cardAccent} shadow-sm`}
          >
            <PlumBlossom className="absolute -top-2 -right-2 h-10 w-10 text-[#e89898]/40 rotate-12" />
            <CardContent className="pt-5 pb-5 pl-6">
              <div className="flex items-baseline gap-3 mb-2">
                <span
                  className={`${fontDisplayZh} text-base text-[#d4685e]`}
                >
                  {t("privacyTitle")}
                </span>
                <span className="h-px flex-1 bg-[#d4685e]/20" />
              </div>
              <p
                className={`text-sm leading-relaxed whitespace-pre-line ${m520Theme.inkSoft}`}
              >
                {privacyNotice}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Cover */}
        {activity.coverImgId && (
          <div className="rounded-xl overflow-hidden ring-1 ring-[#e8c8c0]/60 shadow-sm">
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
            className={`${fontDisplayZh} text-3xl md:text-4xl ${m520Theme.ink}`}
          >
            {activity.title}
          </h2>
          <div className="flex justify-center items-center gap-3">
            <PlumBlossom className="h-3 w-3 text-[#d4685e]/60" />
            <span
              className={`text-xs tracking-[0.3em] uppercase ${m520Theme.inkSoft}`}
            >
              {activity.status === "open" ? t("subtitle") : activity.status}
            </span>
            <PlumBlossom className="h-3 w-3 text-[#d4685e]/60" />
          </div>
          <p
            className={`text-base leading-relaxed whitespace-pre-wrap mx-auto max-w-xl ${m520Theme.inkSoft}`}
          >
            {activity.description}
          </p>
        </div>

        {/* Stat strip — column-separated like a Japanese tabi-card */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#e8c8c0]/60 rounded-xl overflow-hidden ring-1 ring-[#e8c8c0]/60">
          {[
            { label: ta("date"), value: activityDate.toLocaleDateString(locale) },
            {
              label: ta("deadline"),
              value: activityDeadline.toLocaleDateString(locale),
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
              <div className={`text-[10px] tracking-[0.25em] uppercase ${m520Theme.inkSoft}`}>
                {it.label}
              </div>
              <div
                className={`mt-1 truncate text-base ${m520Theme.ink} ${fontDisplayZh}`}
              >
                {it.value}
              </div>
            </div>
          ))}
        </div>

        {/* Steps as a three-blossom timeline */}
        <Card className={`${m520Theme.cardAccent} shadow-sm`}>
          <CardContent className="pt-6 pb-6">
            <div className="flex items-baseline gap-3 mb-5">
              <span
                className={`${fontDisplayZh} text-base text-[#d4685e]`}
              >
                {t("stepsTitle")}
              </span>
              <span className="h-px flex-1 bg-[#d4685e]/20" />
            </div>
            <ol className="grid grid-cols-1 sm:grid-cols-3 gap-6 relative">
              {/* Connector line behind the dots on desktop */}
              <span
                aria-hidden
                className="hidden sm:block absolute top-3 left-[16%] right-[16%] h-px bg-[#e89898]/40"
              />
              {[1, 2, 3].map((n) => (
                <li key={n} className="relative flex flex-col items-center text-center px-2">
                  <div className="bg-[#fdf6ee] rounded-full p-1 mb-3 ring-2 ring-[#e89898]/50">
                    <PlumBlossom className="h-5 w-5 text-[#d4685e]" />
                  </div>
                  <div
                    className={`${fontDisplayZh} text-base ${m520Theme.ink} mb-1`}
                  >
                    {t(`step${n}Title`)}
                  </div>
                  <div className={`text-sm leading-relaxed ${m520Theme.inkSoft}`}>
                    {t(`step${n}Body`)}
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Registration */}
        <Matchmaking520RegistrationPanel
          activityId={activity.id}
          isOpen={isOpen}
          isFull={isFull}
          publicUrlPrefix={getPublicUrl("").replace(/\/$/, "")}
        />
      </div>
    </main>
  );
}
