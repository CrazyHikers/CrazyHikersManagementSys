import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPublicUrl } from "@/lib/r2";
import { HeartMountainIcon, m520Theme } from "./theme";
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
    <main className="flex-1 bg-rose-50/30 dark:bg-rose-950/10">
      {/* Hero */}
      <section className={`${m520Theme.gradientHero} text-white`}>
        <div className="container mx-auto px-4 py-16 max-w-3xl text-center">
          <div className="flex justify-center mb-4">
            <HeartMountainIcon className="h-24 w-24 drop-shadow-lg" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-2 drop-shadow">
            {t("title")}
          </h1>
          <p className="text-lg md:text-xl opacity-95">{t("subtitle")}</p>
          <p className="mt-4 max-w-xl mx-auto opacity-90">{t("intro")}</p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6 -mt-6">
        {/* Privacy */}
        {privacyNotice && (
          <Card className={`${m520Theme.cardAccent} ${m520Theme.cardAccentDark}`}>
            <CardHeader>
              <CardTitle className="text-base">{t("privacyTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground whitespace-pre-line">
              {privacyNotice}
            </CardContent>
          </Card>
        )}

        {/* Cover */}
        {activity.coverImgId && (
          <div className="rounded-lg overflow-hidden bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getPublicUrl(activity.coverImgId)}
              alt={activity.title}
              className="w-full max-h-80 object-contain"
            />
          </div>
        )}

        {/* Title + description */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">{activity.title}</h2>
            <Badge className="bg-rose-500">{activity.status}</Badge>
          </div>
          <p className="text-muted-foreground whitespace-pre-wrap">
            {activity.description}
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">{ta("date")}</div>
              <div className="font-medium">
                {activityDate.toLocaleDateString(locale)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">
                {ta("deadline")}
              </div>
              <div className="font-medium">
                {activityDeadline.toLocaleDateString(locale)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">
                {ta("capacity")}
              </div>
              <div className="font-medium">
                {activity._count.registrations}
                {activity.capacity > 0 ? ` / ${activity.capacity}` : ""}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">
                {ta("manager")}
              </div>
              <div className="font-medium truncate">{managers.join(", ")}</div>
            </CardContent>
          </Card>
        </div>

        {/* Steps */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("stepsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((n) => (
                <li key={n} className="flex gap-3">
                  <div
                    className={`${m520Theme.stepDotActive} text-white rounded-full h-7 w-7 flex items-center justify-center font-bold flex-shrink-0`}
                  >
                    {n}
                  </div>
                  <div>
                    <div className="font-medium">{t(`step${n}Title`)}</div>
                    <div className="text-sm text-muted-foreground">
                      {t(`step${n}Body`)}
                    </div>
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
