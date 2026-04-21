import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const YELLOW_KEYS = ["yellow_1", "yellow_2", "yellow_3", "yellow_4", "yellow_5"] as const;
const RED_KEYS = ["red_1", "red_2", "red_3", "red_4"] as const;

/** Notices shown on every individual activity detail page (all activity routes). */
export async function ActivityNotificationCard() {
  const t = await getTranslations("activity");

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">{t("notification.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <section>
          <h3 className="font-semibold text-foreground mb-1.5">
            {t("notification.activityInfoTitle")}
          </h3>
          <p className="text-muted-foreground">{t("notification.activityInfoBody")}</p>
        </section>
        <section>
          <h3 className="font-semibold text-foreground mb-1.5">
            {t("notification.conductTitle")}
          </h3>
          <p className="text-muted-foreground mb-3">{t("notification.conductIntro")}</p>
          <div className="space-y-3">
            <div>
              <p className="font-medium text-foreground mb-1.5">
                {t("notification.yellowHeading")}
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
                {YELLOW_KEYS.map((key) => (
                  <li key={key}>{t(`notification.${key}`)}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1.5">
                {t("notification.redHeading")}
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
                {RED_KEYS.map((key) => (
                  <li key={key}>{t(`notification.${key}`)}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
