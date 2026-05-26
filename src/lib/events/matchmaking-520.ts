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

// Required: identity, matching constraints, contact, and consent. Everything
// else is optional — leaders found the long form was driving sign-ups away
// (members who just want to come hiking shouldn't have to fill in every box).
export type Matchmaking520FormData = {
  // required
  name: string;
  gender: Gender;
  orientation: Orientation;
  birthYearMonth: string; // "YYYY-MM"
  wechat: string;
  inSwitzerland: boolean;
  consent: true;
  // optional — absent or empty-string both mean "not filled"
  constellation?: string;
  mbti?: string;
  hometown?: string;
  school?: string;
  major?: string;
  stage?: Stage;
  currentCity?: string;
  heightCm?: number;
  weightKg?: number;
  hobbies?: string;
  selfIntro?: string;
  expectations?: string;
  photoKey?: string;
  interestedActivities?: InterestedActivity[];
};

export type Matchmaking520Patch = Partial<Matchmaking520FormData>;

const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export type ValidationError = { field: keyof Matchmaking520FormData; message: string };

export function validateMatchmaking520(
  raw: unknown
): { ok: true; data: Matchmaking520FormData } | { ok: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  // Required string: non-empty after trim, ≤ max chars.
  const requireStr = (k: keyof Matchmaking520FormData, max = 500) => {
    const v = o[k];
    if (typeof v !== "string" || !v.trim()) errors.push({ field: k, message: "required" });
    else if (v.length > max) errors.push({ field: k, message: "too_long" });
  };
  // Optional string: absent/null/"" treated as not filled; length bound still enforced when present.
  const optionalStr = (k: keyof Matchmaking520FormData, max = 500) => {
    const v = o[k];
    if (v == null || v === "") return;
    if (typeof v !== "string") errors.push({ field: k, message: "invalid" });
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
  const optionalEnum = <T extends readonly string[]>(
    k: keyof Matchmaking520FormData,
    allowed: T
  ) => {
    const v = o[k];
    if (v == null || v === "") return;
    if (typeof v !== "string" || !allowed.includes(v as T[number])) {
      errors.push({ field: k, message: "invalid" });
    }
  };
  const optionalNum = (k: keyof Matchmaking520FormData, min: number, max: number) => {
    const v = o[k];
    if (v == null || v === "") return;
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) {
      errors.push({ field: k, message: "out_of_range" });
    }
  };

  // ---- Required (7) ----
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
  requireStr("wechat", 100);
  if (typeof o.inSwitzerland !== "boolean") errors.push({ field: "inSwitzerland", message: "invalid" });
  if (o.consent !== true) errors.push({ field: "consent", message: "required" });

  // ---- Optional (everything else) ----
  optionalStr("constellation", 20);
  optionalStr("mbti", 10);
  optionalStr("hometown", 100);
  optionalStr("school", 200);
  optionalStr("major", 200);
  optionalEnum("stage", STAGE_VALUES);
  optionalStr("currentCity", 100);
  optionalNum("heightCm", 100, 250);
  optionalNum("weightKg", 30, 200);
  optionalStr("hobbies", 1000);
  optionalStr("selfIntro", 2000);
  optionalStr("expectations", 2000);
  optionalStr("photoKey", 500);
  if (o.interestedActivities != null) {
    if (!Array.isArray(o.interestedActivities)) {
      errors.push({ field: "interestedActivities", message: "invalid" });
    } else if (
      !(o.interestedActivities as unknown[]).every((x) =>
        INTERESTED_ACTIVITY_VALUES.includes(x as InterestedActivity)
      )
    ) {
      errors.push({ field: "interestedActivities", message: "invalid" });
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  // Normalize: drop empty/absent optional fields so the DB stores a clean blob
  // and downstream consumers (manager dashboard, balance card) see undefined
  // rather than empty strings.
  const pickStr = (k: string): string | undefined => {
    const v = o[k];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  const pickNum = (k: string): number | undefined => {
    const v = o[k];
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
  };
  const stageRaw = o.stage;
  const interested = Array.isArray(o.interestedActivities)
    ? (o.interestedActivities as InterestedActivity[])
    : undefined;
  const data: Matchmaking520FormData = {
    name: (o.name as string).trim(),
    gender: o.gender as Gender,
    orientation: o.orientation as Orientation,
    birthYearMonth: o.birthYearMonth as string,
    wechat: (o.wechat as string).trim(),
    inSwitzerland: o.inSwitzerland as boolean,
    consent: true,
    constellation: pickStr("constellation"),
    mbti: pickStr("mbti"),
    hometown: pickStr("hometown"),
    school: pickStr("school"),
    major: pickStr("major"),
    stage:
      typeof stageRaw === "string" && (STAGE_VALUES as readonly string[]).includes(stageRaw)
        ? (stageRaw as Stage)
        : undefined,
    currentCity: pickStr("currentCity"),
    heightCm: pickNum("heightCm"),
    weightKg: pickNum("weightKg"),
    hobbies: pickStr("hobbies"),
    selfIntro: pickStr("selfIntro"),
    expectations: pickStr("expectations"),
    photoKey: pickStr("photoKey"),
    interestedActivities: interested && interested.length > 0 ? interested : undefined,
  };
  return { ok: true, data };
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
