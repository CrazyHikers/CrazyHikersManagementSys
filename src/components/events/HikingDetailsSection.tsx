import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";

// Shared "line info" block for the bespoke event landings (matchmaking_520,
// audience_520). Mirrors the Hiking Details card on the default activity
// detail page — same fields sourced from activity.metadata — but the visual
// shell is themeable so each event keeps its own palette/typography.
//
// Intentionally does NOT render the conduct / yellow-red-flag notice
// (ActivityNotificationCard); the event landings omit that on purpose.
export async function HikingDetailsSection({
  metadata,
  cardClassName = "",
  headingClassName = "",
  dividerClassName = "",
  labelClassName = "",
  valueClassName = "",
}: {
  metadata: unknown;
  cardClassName?: string;
  headingClassName?: string;
  dividerClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
}) {
  const t = await getTranslations("activity");
  const meta =
    metadata && typeof metadata === "object"
      ? (metadata as Record<string, unknown>)
      : null;
  if (!meta) return null;

  const has = (key: string) => meta[key] != null && meta[key] !== "";
  const stars = (n: unknown) =>
    typeof n === "number" ? "★".repeat(n) + "☆".repeat(5 - n) : "";

  const fields: { key: string; label: string; value: string; full?: boolean }[] =
    [];
  if (has("route"))
    fields.push({ key: "route", label: t("route"), value: String(meta.route) });
  if (has("distance"))
    fields.push({
      key: "distance",
      label: t("distance"),
      value: `${Number(meta.distance)} km`,
    });
  if (has("elevationGain"))
    fields.push({
      key: "elevationGain",
      label: t("elevationGain"),
      value: `${Number(meta.elevationGain)} m`,
    });
  if (has("elevationLoss"))
    fields.push({
      key: "elevationLoss",
      label: t("elevationLoss"),
      value: `${Number(meta.elevationLoss)} m`,
    });
  if (has("duration"))
    fields.push({
      key: "duration",
      label: t("duration"),
      value: String(meta.duration),
    });
  if (has("technicalDifficulty"))
    fields.push({
      key: "technicalDifficulty",
      label: t("technicalDifficulty"),
      value: stars(meta.technicalDifficulty),
    });
  if (has("enduranceDifficulty"))
    fields.push({
      key: "enduranceDifficulty",
      label: t("enduranceDifficulty"),
      value: stars(meta.enduranceDifficulty),
    });
  if (has("notes"))
    fields.push({
      key: "notes",
      label: t("hikingNotes"),
      value: String(meta.notes),
      full: true,
    });

  if (fields.length === 0) return null;

  return (
    <Card className={cardClassName}>
      <CardContent className="pt-6 pb-6">
        <div className="flex items-baseline gap-3 mb-5">
          <span className={headingClassName}>{t("hikingDetails")}</span>
          <span className={`h-px flex-1 ${dividerClassName}`} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {fields.map((f) => (
            <div key={f.key} className={f.full ? "sm:col-span-2" : ""}>
              <div
                className={`text-[10px] tracking-[0.25em] uppercase ${labelClassName}`}
              >
                {f.label}
              </div>
              <div
                className={`mt-1 ${f.full ? "whitespace-pre-wrap" : ""} ${valueClassName}`}
              >
                {f.value}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
