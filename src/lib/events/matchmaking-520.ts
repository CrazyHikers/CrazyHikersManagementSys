// Keep the literal value; `satisfies TemplateTag` will fail to compile
// if the matching key is removed from src/lib/events/templates.ts.
import type { TemplateTag } from "./templates";
export const MATCHMAKING_520_TEMPLATE = "matchmaking_520" satisfies TemplateTag;
export const MATCHMAKING_520_SLUG = "520" as const;

export const GENDER_VALUES = ["male", "female"] as const;
export type Gender = (typeof GENDER_VALUES)[number];

export const ORIENTATION_VALUES = ["same", "opposite"] as const;
export type Orientation = (typeof ORIENTATION_VALUES)[number];

export const STAGE_VALUES = [
  "bachelor",
  "master",
  "phd",
  "working",
  "other",
] as const;
export type Stage = (typeof STAGE_VALUES)[number];

export const INTERESTED_ACTIVITY_VALUES = [
  "hiking",
  "boardgame_offline",
  "online_cp_match",
  "boardgame_online",
] as const;
export type InterestedActivity = (typeof INTERESTED_ACTIVITY_VALUES)[number];

export type Matchmaking520FormData = {
  name: string;
  gender: Gender;
  orientation: Orientation;
  birthYearMonth: string; // "YYYY-MM"
  constellation: string;
  mbti: string;
  hometown: string;
  school: string;
  major: string;
  stage: Stage;
  currentCity: string;
  heightCm: number;
  weightKg: number;
  hobbies: string;
  selfIntro: string;
  expectations: string;
  wechat: string;
  inSwitzerland: boolean;
  photoKey: string;
  interestedActivities: InterestedActivity[];
  consent: true;
};

export type Matchmaking520Patch = Partial<Matchmaking520FormData>;

const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export type ValidationError = { field: keyof Matchmaking520FormData; message: string };

export function validateMatchmaking520(
  raw: unknown
): { ok: true; data: Matchmaking520FormData } | { ok: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const requireStr = (k: keyof Matchmaking520FormData, max = 500) => {
    const v = o[k];
    if (typeof v !== "string" || !v.trim()) errors.push({ field: k, message: "required" });
    else if (v.length > max) errors.push({ field: k, message: "too_long" });
  };
  const requireEnum = <T extends readonly string[]>(
    k: keyof Matchmaking520FormData,
    allowed: T
  ) => {
    if (typeof o[k] !== "string" || !allowed.includes(o[k] as T[number])) {
      errors.push({ field: k, message: "invalid" });
    }
  };
  const requireNum = (k: keyof Matchmaking520FormData, min: number, max: number) => {
    const v = o[k];
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) {
      errors.push({ field: k, message: "out_of_range" });
    }
  };

  requireStr("name", 100);
  requireEnum("gender", GENDER_VALUES);
  requireEnum("orientation", ORIENTATION_VALUES);
  if (typeof o.birthYearMonth !== "string" || !YEAR_MONTH_RE.test(o.birthYearMonth as string)) {
    errors.push({ field: "birthYearMonth", message: "invalid" });
  } else {
    const y = Number((o.birthYearMonth as string).slice(0, 4));
    const currentYear = new Date().getFullYear();
    if (y < 1950 || y > currentYear) errors.push({ field: "birthYearMonth", message: "out_of_range" });
  }
  requireStr("constellation", 20);
  requireStr("mbti", 10);
  requireStr("hometown", 100);
  requireStr("school", 200);
  requireStr("major", 200);
  requireEnum("stage", STAGE_VALUES);
  requireStr("currentCity", 100);
  requireNum("heightCm", 100, 250);
  requireNum("weightKg", 30, 200);
  requireStr("hobbies", 1000);
  requireStr("selfIntro", 2000);
  requireStr("expectations", 2000);
  requireStr("wechat", 100);
  if (typeof o.inSwitzerland !== "boolean") errors.push({ field: "inSwitzerland", message: "invalid" });
  requireStr("photoKey", 500);
  if (!Array.isArray(o.interestedActivities) || o.interestedActivities.length === 0) {
    errors.push({ field: "interestedActivities", message: "required" });
  } else if (
    !(o.interestedActivities as unknown[]).every((x) =>
      INTERESTED_ACTIVITY_VALUES.includes(x as InterestedActivity)
    )
  ) {
    errors.push({ field: "interestedActivities", message: "invalid" });
  }
  if (o.consent !== true) errors.push({ field: "consent", message: "required" });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data: o as Matchmaking520FormData };
}

// Age band derivation for the manager balance card.
export type AgeBand = "<=22" | "23-26" | "27-30" | "31+";
export function ageBandFromBirthYearMonth(
  birthYearMonth: string,
  asOf: Date = new Date()
): AgeBand | null {
  if (!YEAR_MONTH_RE.test(birthYearMonth)) return null;
  const [yStr, mStr] = birthYearMonth.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  let age = asOf.getUTCFullYear() - y;
  if (asOf.getUTCMonth() + 1 < m) age -= 1;
  if (age <= 22) return "<=22";
  if (age <= 26) return "23-26";
  if (age <= 30) return "27-30";
  return "31+";
}
