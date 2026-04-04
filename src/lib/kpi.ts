import { db } from "./db";
import { getSetting } from "./settings";

/**
 * Compute KPI for a manager on the fly by querying completed activities.
 * Points are configurable via app_settings.
 */
export async function computeKpi(userEmail: string): Promise<number> {
  const [managerPoints, comanagerPoints] = await Promise.all([
    getSetting("kpi_manager_points"),
    getSetting("kpi_comanager_points"),
  ]);

  const [managedCount, comanagedCount] = await Promise.all([
    db.activityManager.count({
      where: {
        userEmail,
        role: "manager",
        status: "confirmed",
        activity: { status: "completed" },
      },
    }),
    db.activityManager.count({
      where: {
        userEmail,
        role: "comanager",
        status: "confirmed",
        activity: { status: "completed" },
      },
    }),
  ]);

  return managedCount * managerPoints + comanagedCount * comanagerPoints;
}

/**
 * Get the current hiking season boundaries.
 * Season start month is configurable (default: November = 11).
 */
export async function getCurrentSeason(): Promise<{ start: Date; end: Date }> {
  const startMonth = await getSetting("kpi_season_start_month");
  const monthIndex = startMonth - 1; // JS months are 0-indexed
  const now = new Date();
  const year = now.getMonth() >= monthIndex ? now.getFullYear() : now.getFullYear() - 1;
  return {
    start: new Date(year, monthIndex, 1),
    end: new Date(year + 1, monthIndex, 1),
  };
}

/**
 * Count main-managed completed activities in the current season.
 */
export async function getSeasonManagedCount(userEmail: string): Promise<number> {
  const { start, end } = await getCurrentSeason();
  return db.activityManager.count({
    where: {
      userEmail,
      role: "manager",
      status: "confirmed",
      activity: {
        status: "completed",
        date: { gte: start, lt: end },
      },
    },
  });
}
