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
  managerNames: string;
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
  managerNames,
}: ActivityCardProps) {
  const t = useTranslations("home");
  const spotsLeft = capacity > 0 ? capacity - currentRegistrations : null;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
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
            </div>
            <Link href={`/activities/${id}`}>
              <Button size="sm" className="bg-green-600 hover:bg-green-700">
                {t("register")}
              </Button>
            </Link>
          </CardContent>
        </div>
      </div>
    </Card>
  );
}
