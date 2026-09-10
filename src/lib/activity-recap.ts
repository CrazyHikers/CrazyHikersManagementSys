export const MAX_RECAP_PHOTOS = 12;
export const MAX_RECAP_TEXT = 5000;

export type ActivityRecap = {
  albumUrl: string;
  description: string;
  photoKeys: string[];
};
export type PublicActivityRecap = Omit<ActivityRecap, "albumUrl">;

export function parseActivityRecap(value: unknown, activityId: string): ActivityRecap | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.albumUrl !== "string" || typeof v.description !== "string" || !Array.isArray(v.photoKeys)) return null;
  const albumUrl = v.albumUrl.trim();
  const description = v.description.trim();
  if (albumUrl.length > 2048 || description.length > MAX_RECAP_TEXT || v.photoKeys.length > MAX_RECAP_PHOTOS) return null;
  if (albumUrl) {
    try {
      const url = new URL(albumUrl);
      if (url.protocol !== "https:" || url.username || url.password) return null;
    } catch { return null; }
  }
  const prefix = `activity-recaps/${activityId}/`;
  if (!v.photoKeys.every((key) => typeof key === "string" && key.startsWith(prefix) && /^[a-f0-9-]{36}\.(jpg|png|webp|gif|avif)$/.test(key.slice(prefix.length)))) return null;
  if (new Set(v.photoKeys).size !== v.photoKeys.length) return null;
  return { albumUrl, description, photoKeys: v.photoKeys as string[] };
}

export function readActivityRecap(metadata: unknown, activityId: string): PublicActivityRecap | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = (metadata as Record<string, unknown>).recap;
  if (!raw || typeof raw !== "object") return null;
  const parsed = parseActivityRecap({ ...raw, albumUrl: "" }, activityId);
  return parsed ? { description: parsed.description, photoKeys: parsed.photoKeys } : null;
}

export function hasActivityRecap(recap: (PublicActivityRecap & { albumUrl?: string }) | null): boolean {
  return !!recap && !!(recap.albumUrl || recap.description || recap.photoKeys.length);
}

export function canEditActivityRecap(
  user: { email?: string | null; role?: string } | undefined,
  managers: { userEmail: string; status: string; role: string }[],
): boolean {
  if (!user?.email) return false;
  if (user.role === "admin" || user.role === "dev") return true;
  return user.role === "manager" && managers.some((m) => m.userEmail === user.email && m.status === "confirmed" && ["manager", "comanager"].includes(m.role));
}
