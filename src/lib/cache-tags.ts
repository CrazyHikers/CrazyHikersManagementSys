// Centralized cache tag names so read sites (unstable_cache) and write
// sites (revalidateTag) can't drift apart. Change a name here and
// both ends update.
export const cacheTags = {
  /** One specific activity's cached payload (detail page, metadata, etc.). */
  activity: (id: string) => `activity:${id}`,
  /** All activity-list-shaped caches — the landing page list, etc.
   *  Invalidate when an activity is created, deleted, or when its
   *  listing-relevant fields (status, deadline, date, capacity,
   *  submission count, managers) change. */
  activities: "activities",
  /** App settings (flag durations, waiver validity, rate limits, …). */
  appSettings: "app-settings",
} as const;
