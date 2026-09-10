import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicUrl } from "@/lib/r2";
import { hasActivityRecap, type PublicActivityRecap } from "@/lib/activity-recap";

export async function ActivityRecapSection({ recap }: { recap: PublicActivityRecap | null }) {
  const t = await getTranslations("recap");
  if (!recap || !hasActivityRecap(recap)) return null;
  return (
    <Card className="mb-6">
      <CardHeader><CardTitle>{t("title")}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {recap.description && <p className="whitespace-pre-wrap break-words">{recap.description}</p>}
        {recap.photoKeys.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recap.photoKeys.map((key, index) => (
              <a key={key} href={getPublicUrl(key)} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getPublicUrl(key)} alt={t("photoAlt", { number: index + 1 })} loading="lazy" className="w-full aspect-[4/3] rounded-lg object-cover" />
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
