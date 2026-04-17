import { useTranslations } from "next-intl";
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
}: ActivityCardProps) {
  const t = useTranslations("home");
  const spotsLeft = capacity > 0 ? capacity - currentRegistrations : null;
  const showSubmissions = !!maximumRegistration && maximumRegistration > 0;
  // Only show the conflict state when the user isn't already involved with
  // this activity in another way (managing / invited / registered).
  const showConflict = !!sameDayConflict && !managing && !pendingInvitation && !registered;

  return (
    <Link href={`/activities/${id}`} className="block">
      <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex flex-col sm:flex-row">
          {coverImgUrl && (
            <div className="sm:w-48 h-40 sm:h-auto flex-shrink-0">
              <img
                src={coverImgUrl}
                alt={title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-lg leading-tight">{title}</CardTitle>
                {spotsLeft !== null && (
                  <Badge variant={spotsLeft > 0 ? "secondary" : "destructive"}>
                    {spotsLeft > 0
                      ? t("spotsLeft", { count: spotsLeft })
                      : t("spotsFull")}
                  </Badge>
                )}
              </div>
              <CardDescription className="line-clamp-2">
                {description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-col gap-1 text-sm text-muted-foreground mb-3">
                <div>
                  {t("activityDate")}:{" "}
                  {new Date(date).toLocaleDateString()}
                </div>
                <div>
                  {t("deadline")}:{" "}
                  {new Date(deadline).toLocaleDateString()}
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
              {managing ? (
                <Button size="sm" variant="outline" tabIndex={-1}>
                  {t("managing")}
                </Button>
              ) : pendingInvitation ? (
                <Button size="sm" variant="outline" className="text-amber-700 border-amber-600" tabIndex={-1}>
                  {t("pendingInvitation")}
                </Button>
              ) : registered ? (
                <Button size="sm" variant="outline" className="text-green-700 border-green-600" tabIndex={-1}>
                  {t("registered")}
                </Button>
              ) : showConflict ? (
                <Button size="sm" variant="outline" className="text-red-700 border-red-600" tabIndex={-1}>
                  {sameDayConflict!.role === "manager"
                    ? t("sameDayManaging", { title: sameDayConflict!.title })
                    : t("sameDayConfirmed", { title: sameDayConflict!.title })}
                </Button>
              ) : (
                <Button size="sm" className="bg-green-600 hover:bg-green-700" tabIndex={-1}>
                  {t("register")}
                </Button>
              )}
            </CardContent>
          </div>
        </div>
      </Card>
    </Link>
  );
}
