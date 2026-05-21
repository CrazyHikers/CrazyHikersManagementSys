// Schema / validation for the 5·20 audience-team template.
//
// Sister event to matchmaking_520 — the audience team comes to witness
// and cheer rather than be matched, so the form only collects light
// logistical info: identity, contact, location, photo consent.

import { GENDER_VALUES, type Gender } from "./matchmaking-520";

export const AUDIENCE_520_TEMPLATE = "audience_520" as const;

export type Audience520FormData = {
  name: string;
  gender: Gender;
  currentCity: string;
  wechat: string;
  inSwitzerland: boolean;
  willingToBePhotographed: boolean;
  expectations: string; // optional in spirit; allowed empty
  consent: true;
};

export type Audience520Patch = Partial<Audience520FormData>;

export type ValidationError = {
  field: keyof Audience520FormData;
  message: string;
};

export function validateAudience520(
  raw: unknown
):
  | { ok: true; data: Audience520FormData }
  | { ok: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;

  const requireStr = (k: keyof Audience520FormData, max = 500) => {
    const v = o[k];
    if (typeof v !== "string" || !v.trim())
      errors.push({ field: k, message: "required" });
    else if (v.length > max) errors.push({ field: k, message: "too_long" });
  };

  requireStr("name", 100);
  if (
    typeof o.gender !== "string" ||
    !GENDER_VALUES.includes(o.gender as Gender)
  ) {
    errors.push({ field: "gender", message: "invalid" });
  }
  requireStr("currentCity", 100);
  requireStr("wechat", 100);
  if (typeof o.inSwitzerland !== "boolean")
    errors.push({ field: "inSwitzerland", message: "invalid" });
  if (typeof o.willingToBePhotographed !== "boolean")
    errors.push({ field: "willingToBePhotographed", message: "invalid" });
  // expectations is optional but length-bounded if present
  if (o.expectations != null) {
    if (typeof o.expectations !== "string") {
      errors.push({ field: "expectations", message: "invalid" });
    } else if (o.expectations.length > 1000) {
      errors.push({ field: "expectations", message: "too_long" });
    }
  }
  if (o.consent !== true) errors.push({ field: "consent", message: "required" });

  if (errors.length > 0) return { ok: false, errors };
  const data: Audience520FormData = {
    name: (o.name as string).trim(),
    gender: o.gender as Gender,
    currentCity: (o.currentCity as string).trim(),
    wechat: (o.wechat as string).trim(),
    inSwitzerland: o.inSwitzerland as boolean,
    willingToBePhotographed: o.willingToBePhotographed as boolean,
    expectations:
      typeof o.expectations === "string" ? o.expectations.trim() : "",
    consent: true,
  };
  return { ok: true, data };
}
