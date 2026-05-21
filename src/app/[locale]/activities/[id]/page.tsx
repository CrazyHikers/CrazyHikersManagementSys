import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getPublicUrl } from "@/lib/r2";
import { cacheTags } from "@/lib/cache-tags";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityRegistrationPanel } from "@/components/activity-registration-panel";
import { ShareButton } from "@/components/share-button";
import { ActivityNotificationCard } from "@/components/activity-notification-card";
import { getTemplate } from "@/lib/events/templates";

// Activity payload is shared across all visitors — cache it with a
// per-ID tag. Write routes call revalidateTag(cacheTags.activity(id))
// on edits, registration changes, manager accept/decline, etc. The
// 1-day revalidate is a safety net; correctness comes from the tag.
function getActivity(id: string) {
  return unstable_cache(
    async () => {
      return db.activity.findUnique({
        where: { id },
        include: {
          activityManagers: {
            where: { status: "confirmed" },
            include: { user: { include: { managerProfile: true } } },
          },
          _count: {
            select: {
              registrations: {
                where: {
                  status: { in: ["registration_confirmed", "attended"] },
                },
              },
            },
          },
        },
      });
    },
    ["activity-detail", id],
    { tags: [cacheTags.activity(id)], revalidate: 86400 }
  )();
}

function getActivityMetadata(id: string) {
  return unstable_cache(
    async () => {
      return db.activity.findUnique({
        where: { id },
        select: { title: true, description: true, coverImgId: true, date: true },
      });
    },
    ["activity-metadata", id],
    { tags: [cacheTags.activity(id)], revalidate: 86400 }
  )();
}

// Emit OG / Twitter Card metadata so shared links render rich previews
// (WeChat, Slack, iMessage, Twitter, Telegram, etc.). The crawler fetches
// this page and reads the <meta> tags — no extra work is needed beyond
// shipping accurate tags here.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const activity = await getActivityMetadata(id);

  if (!activity) return {};

  // Truncate long descriptions so they fit inside card previews.
  const rawDescription = activity.description?.trim() ?? "";
  const description =
    rawDescription.length > 200
      ? `${rawDescription.slice(0, 197)}…`
      : rawDescription || `Join us for ${activity.title} on ${new Date(activity.date).toLocaleDateString()}.`;

  const imageUrl = activity.coverImgId ? getPublicUrl(activity.coverImgId) : undefined;

  return {
    title: activity.title,
    description,
    openGraph: {
      title: activity.title,
      description,
      type: "article",
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title: activity.title,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const t = await getTranslations("activity");
  const activity = await getActivity(id);

  if (!activity) notFound();

  // unstable_cache serializes Dates to ISO strings, so revive them here.
  const activityDate = new Date(activity.date);
  const activityDeadline = new Date(activity.deadline);

  const isOpen =
    activity.status === "open" && activityDeadline > new Date();
  const isFull = !!(
    activity.maximumRegistration &&
    activity.maximumRegistration > 0 &&
    activity._count.registrations >= activity.maximumRegistration
  );

  // Template-specific bespoke landing. When the registry has a
  // loadLanding for the current activity's tag, hand rendering over
  // entirely; otherwise fall through to the default detail page below.
  const template =
    activity.metadata && typeof activity.metadata === "object"
      ? ((activity.metadata as Record<string, unknown>).template as
          | string
          | undefined)
      : undefined;
  const templateDef = getTemplate(template);
  if (templateDef?.loadLanding) {
    const Landing = await templateDef.loadLanding();
    return (
      <>
        <SiteHeader />
        <Landing
          activity={activity}
          locale={locale}
          isOpen={isOpen}
          isFull={isFull}
        />
        <SiteFooter />
      </>
    );
  }

  const managers = activity.activityManagers
    .filter((am) => am.role === "manager")
    .map((am) => am.user.managerProfile?.tag || am.user.name);
  const comanagers = activity.activityManagers
    .filter((am) => am.role === "comanager")
    .map((am) => am.user.managerProfile?.tag || am.user.name);

  const qrCodeUrl =
    ((activity.metadata as Record<string, unknown> | null)?.qrCodeUrl as
      | string
      | undefined) ?? null;

  // Prefer the memorable /events/<slug> URL for sharing when this
  // activity has a slug. Falls back to /activities/<id> otherwise so
  // every share still works.
  const slug = (activity.metadata as Record<string, unknown> | null)?.slug;
  const sharePath =
    typeof slug === "string" && slug.trim() !== ""
      ? `/${locale}/events/${slug}`
      : `/${locale}/activities/${activity.id}`;

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-gray-50">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          {(() => {
            const heroKey = activity.registrationHeroImgId || activity.coverImgId;
            if (!heroKey) return null;
            return (
              <div className="rounded-lg overflow-hidden mb-6 max-h-80 bg-gray-100">
                <img
                  src={getPublicUrl(heroKey)}
                  alt={activity.title}
                  className="w-full h-full max-h-80 object-contain"
                />
              </div>
            );
          })()}

          <div className="mb-6">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-start gap-3">
                <h1 className="text-2xl font-bold">{activity.title}</h1>
                <Badge
                  variant={isOpen && !isFull ? "default" : "secondary"}
                  className={
                    isOpen && !isFull ? "bg-green-600" : ""
                  }
                >
                  {activity.status}
                </Badge>
              </div>
              {activity.status === "open" && activityDeadline > new Date() && (
                <ShareButton
                  path={sharePath}
                  title={activity.title}
                  text={activity.description}
                />
              )}
            </div>
            <p className="text-muted-foreground whitespace-pre-wrap">
              {activity.description}
            </p>
          </div>

          {/* Hiking Details */}
          {activity.metadata && typeof activity.metadata === "object" && Object.keys(activity.metadata as object).length > 0 && (() => {
            const meta = activity.metadata as Record<string, unknown>;
            const stars = (n: unknown) => typeof n === "number" ? "★".repeat(n) + "☆".repeat(5 - n) : "";
            const has = (key: string) => meta[key] != null && meta[key] !== "";
            return (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">{t("hikingDetails")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                    {has("route") ? (
                      <div>
                        <div className="text-sm text-muted-foreground">{t("route")}</div>
                        <div className="font-medium">{String(meta.route)}</div>
                      </div>
                    ) : null}
                    {has("distance") ? (
                      <div>
                        <div className="text-sm text-muted-foreground">{t("distance")}</div>
                        <div className="font-medium">{Number(meta.distance)} km</div>
                      </div>
                    ) : null}
                    {has("elevationGain") ? (
                      <div>
                        <div className="text-sm text-muted-foreground">{t("elevationGain")}</div>
                        <div className="font-medium">{Number(meta.elevationGain)} m</div>
                      </div>
                    ) : null}
                    {has("elevationLoss") ? (
                      <div>
                        <div className="text-sm text-muted-foreground">{t("elevationLoss")}</div>
                        <div className="font-medium">{Number(meta.elevationLoss)} m</div>
                      </div>
                    ) : null}
                    {has("duration") ? (
                      <div>
                        <div className="text-sm text-muted-foreground">{t("duration")}</div>
                        <div className="font-medium">{String(meta.duration)}</div>
                      </div>
                    ) : null}
                    {has("technicalDifficulty") ? (
                      <div>
                        <div className="text-sm text-muted-foreground">{t("technicalDifficulty")}</div>
                        <div className="font-medium">{stars(meta.technicalDifficulty)}</div>
                      </div>
                    ) : null}
                    {has("enduranceDifficulty") ? (
                      <div>
                        <div className="text-sm text-muted-foreground">{t("enduranceDifficulty")}</div>
                        <div className="font-medium">{stars(meta.enduranceDifficulty)}</div>
                      </div>
                    ) : null}
                    {has("notes") ? (
                      <div className="sm:col-span-2">
                        <div className="text-sm text-muted-foreground">{t("hikingNotes")}</div>
                        <div className="font-medium whitespace-pre-wrap">{String(meta.notes)}</div>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          <ActivityNotificationCard />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">
                  {t("date")}
                </div>
                <div className="font-medium">
                  {activityDate.toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">
                  {t("deadline")}
                </div>
                <div className="font-medium">
                  {activityDeadline.toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">
                  {t("capacity")}
                </div>
                <div className="font-medium">
                  {t("registered")}: {activity._count.registrations}
                  {activity.capacity > 0 && ` / ${activity.capacity}`}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">
                  {managers.length > 0 ? t("manager") : ""}
                </div>
                <div className="font-medium">
                  {managers.join(", ")}
                  {comanagers.length > 0 && (
                    <span className="text-muted-foreground">
                      {" "}
                      + {comanagers.join(", ")}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <ActivityRegistrationPanel
            activityId={activity.id}
            qrCodeUrl={qrCodeUrl}
            isOpen={isOpen}
            isFull={isFull}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
