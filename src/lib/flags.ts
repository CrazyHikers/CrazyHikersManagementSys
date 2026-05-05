import { getSettings } from "./settings";

export interface FlagSettings {
  ban_duration_yellow: number;
  ban_duration_red: number;
  flag_expiry_days_yellow: number;
  flag_expiry_days_red: number;
}

export async function getFlagSettings(): Promise<FlagSettings> {
  const settings = await getSettings([
    "ban_duration_yellow",
    "ban_duration_red",
    "flag_expiry_days_yellow",
    "flag_expiry_days_red",
  ]);
  return settings as unknown as FlagSettings;
}

export function computeBanUntil(
  origin: Date,
  flagType: string,
  settings: FlagSettings
): Date {
  const days =
    flagType === "red"
      ? settings.ban_duration_red
      : settings.ban_duration_yellow;
  const result = new Date(origin);
  result.setDate(result.getDate() + days);
  return result;
}

export function computeExpiresAt(
  origin: Date,
  flagType: string,
  settings: FlagSettings
): Date {
  const days =
    flagType === "red"
      ? settings.flag_expiry_days_red
      : settings.flag_expiry_days_yellow;
  const result = new Date(origin);
  result.setDate(result.getDate() + days);
  return result;
}

// Flag windows (ban/expiry) are anchored to the flag's activity date.
export function isBanActive(
  flag: { activity: { date: Date }; flagType: string },
  settings: FlagSettings,
  now: Date = new Date()
): boolean {
  return computeBanUntil(flag.activity.date, flag.flagType, settings) > now;
}

export function isFlagExpired(
  flag: { activity: { date: Date }; flagType: string },
  settings: FlagSettings,
  now: Date = new Date()
): boolean {
  return computeExpiresAt(flag.activity.date, flag.flagType, settings) <= now;
}

/** Cutoff date for unexpired flags: uses max of both expiry periods. Refine with isFlagExpired() per flag. */
export function unexpiredCutoff(
  settings: FlagSettings,
  now: Date = new Date()
): Date {
  const maxExpiryDays = Math.max(
    settings.flag_expiry_days_yellow,
    settings.flag_expiry_days_red
  );
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - maxExpiryDays);
  return cutoff;
}

/** Broad cutoff for active bans: uses max of both ban durations. Refine with isBanActive() per flag. */
export function banActiveCutoff(
  settings: FlagSettings,
  now: Date = new Date()
): Date {
  const maxBanDays = Math.max(
    settings.ban_duration_yellow,
    settings.ban_duration_red
  );
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - maxBanDays);
  return cutoff;
}
