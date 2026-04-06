import { getSettings } from "./settings";

export interface FlagSettings {
  ban_duration_yellow: number;
  ban_duration_red: number;
  flag_expiry_days: number;
}

export async function getFlagSettings(): Promise<FlagSettings> {
  const settings = await getSettings([
    "ban_duration_yellow",
    "ban_duration_red",
    "flag_expiry_days",
  ]);
  return settings as unknown as FlagSettings;
}

export function computeBanUntil(
  issuedAt: Date,
  flagType: string,
  settings: FlagSettings
): Date {
  const days =
    flagType === "red"
      ? settings.ban_duration_red
      : settings.ban_duration_yellow;
  const result = new Date(issuedAt);
  result.setDate(result.getDate() + days);
  return result;
}

export function computeExpiresAt(
  issuedAt: Date,
  settings: FlagSettings
): Date {
  const result = new Date(issuedAt);
  result.setDate(result.getDate() + settings.flag_expiry_days);
  return result;
}

export function isBanActive(
  flag: { issuedAt: Date; flagType: string },
  settings: FlagSettings,
  now: Date = new Date()
): boolean {
  return computeBanUntil(flag.issuedAt, flag.flagType, settings) > now;
}

export function isFlagExpired(
  flag: { issuedAt: Date },
  settings: FlagSettings,
  now: Date = new Date()
): boolean {
  return computeExpiresAt(flag.issuedAt, settings) <= now;
}

/** Cutoff date for unexpired flags: flags with issuedAt > this are potentially unexpired */
export function unexpiredCutoff(
  settings: FlagSettings,
  now: Date = new Date()
): Date {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - settings.flag_expiry_days);
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
