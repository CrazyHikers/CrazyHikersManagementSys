"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ageBandFromBirthYearMonth,
  type AgeBand,
  type Gender,
} from "@/lib/events/matchmaking-520";

type Reg = {
  status: string;
  formData?: Record<string, unknown> | null;
};

const BANDS: AgeBand[] = ["<=22", "23-26", "27-30", "31+"];
const GENDERS: Gender[] = ["male", "female"];
const BAND_KEY: Record<AgeBand, string> = {
  "<=22": "band_le22",
  "23-26": "band_23_26",
  "27-30": "band_27_30",
  "31+": "band_31p",
};

export function BalanceCard({ registrations }: { registrations: Reg[] }) {
  const t = useTranslations("events.matchmaking520.manager");

  const matrix: Record<
    Gender,
    Record<AgeBand, { confirmed: number; pending: number }>
  > = {
    male: {
      "<=22": { confirmed: 0, pending: 0 },
      "23-26": { confirmed: 0, pending: 0 },
      "27-30": { confirmed: 0, pending: 0 },
      "31+": { confirmed: 0, pending: 0 },
    },
    female: {
      "<=22": { confirmed: 0, pending: 0 },
      "23-26": { confirmed: 0, pending: 0 },
      "27-30": { confirmed: 0, pending: 0 },
      "31+": { confirmed: 0, pending: 0 },
    },
  };

  for (const r of registrations) {
    const g = (r.formData?.gender as Gender | undefined) ?? null;
    const bym = (r.formData?.birthYearMonth as string | undefined) ?? "";
    const band = bym ? ageBandFromBirthYearMonth(bym) : null;
    if (!g || !band || !GENDERS.includes(g)) continue;
    const bucket =
      r.status === "registration_confirmed" || r.status === "attended"
        ? "confirmed"
        : "pending";
    matrix[g][band][bucket] += 1;
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-base">{t("balanceTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-3"></th>
                {BANDS.map((b) => (
                  <th key={b} className="py-1 px-2">
                    {t(BAND_KEY[b])}
                  </th>
                ))}
                <th className="py-1 pl-2">{t("totalLabel")}</th>
              </tr>
            </thead>
            <tbody>
              {GENDERS.map((g) => {
                const rowTotal = BANDS.reduce(
                  (acc, b) => ({
                    c: acc.c + matrix[g][b].confirmed,
                    p: acc.p + matrix[g][b].pending,
                  }),
                  { c: 0, p: 0 }
                );
                return (
                  <tr key={g} className="border-t">
                    <td className="py-2 pr-3 font-medium">{t(g)}</td>
                    {BANDS.map((b) => (
                      <td key={b} className="py-2 px-2 tabular-nums">
                        <span className="font-medium">
                          {matrix[g][b].confirmed}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {matrix[g][b].pending}
                        </span>
                      </td>
                    ))}
                    <td className="py-2 pl-2 tabular-nums">
                      <span className="font-bold">{rowTotal.c}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {rowTotal.p}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("confirmedLabel")} · {t("pendingLabel")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
