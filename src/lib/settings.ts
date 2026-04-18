import { unstable_cache } from "next/cache";
import { db } from "./db";

// Default values for all configurable settings
export const DEFAULTS: Record<string, number> = {
  // Flag system
  ban_duration_yellow: 7,
  ban_duration_red: 30,
  flag_expiry_days_yellow: 180,
  flag_expiry_days_red: 365,
  yellow_to_red_threshold: 3,

  // Waivers
  waiver_validity_days: 365,

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
  qualified_min_managed_per_season: 1,

  // Upload
  max_upload_size_mb: 5,

  // Rate limiting
  rate_limit_signin_max: 3,
  rate_limit_signin_window_minutes: 15,
  rate_limit_signup_max: 5,
  rate_limit_signup_window_minutes: 15,
  rate_limit_register_max: 10,
  rate_limit_register_window_minutes: 15,
};

// Settings are admin-edited config; they change rarely but were previously
// re-read from the DB on every API call (registration, preflight, etc.)
// — a meaningful share of Fluid CPU. Cache for 10 min and invalidate via
// revalidateTag("app-settings") when the admin edits them.
const getAllSettings = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const result: Record<string, number> = {};
    try {
      const settings = await db.appSettings.findMany();
      for (const s of settings) {
        result[s.key] = parseInt(s.value, 10);
      }
    } catch {
      // DB error — callers fall back to DEFAULTS
    }
    return result;
  },
  ["app-settings"],
  { tags: ["app-settings"], revalidate: 600 }
);

/**
 * Get a numeric setting value, falling back to the default.
 */
export async function getSetting(key: string): Promise<number> {
  const all = await getAllSettings();
  if (key in all) return all[key];
  return DEFAULTS[key] ?? 0;
}

/**
 * Get multiple settings at once.
 */
export async function getSettings(keys: string[]): Promise<Record<string, number>> {
  const all = await getAllSettings();
  const result: Record<string, number> = {};
  for (const key of keys) {
    result[key] = key in all ? all[key] : DEFAULTS[key] ?? 0;
  }
  return result;
}
