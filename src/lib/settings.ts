import { db } from "./db";

// Default values for all configurable settings
export const DEFAULTS: Record<string, number> = {
  // Flag system
  ban_duration_yellow: 7,
  ban_duration_red: 30,
  flag_expiry_days: 180,
  yellow_to_red_threshold: 3,

  // Waivers
  waiver_validity_days: 365,
  waiver_expiry_warning_days: 7,

  // Promotions
  promotion_vote_duration_hours: 24,
  promotion_vote_approval_ratio: 67, // percentage (2/3 ≈ 67%)
  promotion_min_attended_activities: 3,
  promotion_min_distinct_managers: 2,
  promotion_min_managed_activities: 2,
  promotion_min_comanaged_activities: 2,
  promotion_referral_count: 2,

  // KPI
  kpi_manager_points: 2,
  kpi_comanager_points: 1,
  kpi_season_start_month: 11, // November (1-indexed)
  intern_max_seasons: 2,

  // Rate limiting
  rate_limit_signin_max: 3,
  rate_limit_signin_window_minutes: 15,
  rate_limit_signup_max: 5,
  rate_limit_signup_window_minutes: 15,
  rate_limit_register_max: 10,
  rate_limit_register_window_minutes: 15,
};

/**
 * Get a numeric setting value, falling back to the default.
 */
export async function getSetting(key: string): Promise<number> {
  try {
    const setting = await db.appSettings.findUnique({ where: { key } });
    if (setting) return parseInt(setting.value, 10);
  } catch {
    // DB error — use default
  }
  return DEFAULTS[key] ?? 0;
}

/**
 * Get multiple settings at once.
 */
export async function getSettings(keys: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  try {
    const settings = await db.appSettings.findMany({
      where: { key: { in: keys } },
    });
    for (const s of settings) {
      result[s.key] = parseInt(s.value, 10);
    }
  } catch {
    // DB error — use defaults
  }
  for (const key of keys) {
    if (!(key in result)) {
      result[key] = DEFAULTS[key] ?? 0;
    }
  }
  return result;
}
