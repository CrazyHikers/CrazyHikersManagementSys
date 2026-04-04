import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getPublicUrl } from "@/lib/r2";
import { auth } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { RegistrationForm } from "@/components/registration-form";

async function getActivity(id: string) {
  return db.activity.findUnique({
    where: { id },
    include: {
      activityManagers: {
        where: { status: "confirmed" },
        include: { user: true },
      },
      _count: {
        select: {
          registrations: {
            where: {
              status: { in: ["registered", "registration_confirmed"] },
            },
          },
        },
      },
    },
  });
}

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("activity");
  const session = await auth();
  const activity = await getActivity(id);

  if (!activity) notFound();

  const isOpen =
    activity.status === "open" && new Date(activity.deadline) > new Date();
  const isFull =
    activity.maximumRegistration &&
    activity.maximumRegistration > 0 &&
    activity._count.registrations >= activity.maximumRegistration;

  const managers = activity.activityManagers
    .filter((am) => am.role === "manager")
    .map((am) => am.user.name);
  const comanagers = activity.activityManagers
    .filter((am) => am.role === "comanager")
    .map((am) => am.user.name);

  const sessionUser = session?.user
    ? { name: session.user.name, email: session.user.email }
    : null;

  return (
    <>
      <SiteHeader user={session?.user ?? null} />
      <main className="flex-1 bg-gray-50">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          {activity.coverImgId && (
            <div className="rounded-lg overflow-hidden mb-6 max-h-80 bg-gray-100">
              <img
                src={getPublicUrl(activity.coverImgId)}
                alt={activity.title}
                className="w-full h-full max-h-80 object-contain"
              />
            </div>
          )}

          <div className="mb-6">
            <div className="flex items-start gap-3 mb-2">
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
            <p className="text-muted-foreground whitespace-pre-wrap">
              {activity.description}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">
                  {t("date")}
                </div>
                <div className="font-medium">
                  {activity.date.toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">
                  {t("deadline")}
                </div>
                <div className="font-medium">
                  {activity.deadline.toLocaleDateString()}
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
                  {managers.length > 0 ? "Manager" : ""}
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

          {isOpen && !isFull ? (
            session?.user ? (
              <Card>
                <CardHeader>
                  <CardTitle>{t("registrationForm")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <RegistrationForm
                    activityId={activity.id}
                    session={sessionUser}
                  />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground mb-4">{t("signInToRegister")}</p>
                  <Link href="/signin">
                    <Button className="bg-green-600 hover:bg-green-700">
                      {t("signIn")}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {isFull ? t("registrationClosed") : t("registrationClosed")}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </>
  );
}
