// Channel-agnostic notification types.
//
// Two-layer separation:
//   - NotificationMeta: what gets shown (title, body, link, tag). Built by
//     callers (or by helpers in ./messages.ts) and dispatched to channels.
//     Channels know how to wrap meta in their transport (web-push JSON,
//     Discord embed, WeChat template) but never see the kind or domain
//     event data.
//   - NotificationKind: identifies which event the dispatch represents,
//     used by the notify lib for per-user preference filtering. Channels
//     don't see the kind.

export type ChannelId = "web-push" | "telegram" | "discord";
// Future: | "wechat";

export type NotificationKind =
  | "activity_created"
  | "registration_confirmed"
  | "poll_published"
  | "comanager_invited"
  | "comanager_response"
  | "confirm_registrations_reminder"
  | "finalize_activity_reminder";

// Toggleable kinds visible to all users (members + managers + admins).
export const MEMBER_KINDS = [
  "activity_created",
  "registration_confirmed",
  "poll_published",
] as const;

// Toggleable kinds visible only to manager/admin/dev. Non-managers won't see
// these in the settings UI, and the cron/event hooks targeting these kinds
// only ever address manager users anyway.
export const MANAGER_KINDS = [
  "comanager_invited",
  "comanager_response",
  "confirm_registrations_reminder",
  "finalize_activity_reminder",
] as const;

export const USER_TOGGLEABLE_KINDS = [
  ...MEMBER_KINDS,
  ...MANAGER_KINDS,
] as const satisfies readonly NotificationKind[];

export type MemberKind = (typeof MEMBER_KINDS)[number];
export type ManagerKind = (typeof MANAGER_KINDS)[number];
export type UserToggleableKind = (typeof USER_TOGGLEABLE_KINDS)[number];

export type NotificationPreferences = Partial<
  Record<UserToggleableKind, boolean>
>;

export const DEFAULT_PREFS: Required<NotificationPreferences> = {
  activity_created: true,
  registration_confirmed: true,
  poll_published: true,
  comanager_invited: true,
  comanager_response: true,
  confirm_registrations_reminder: true,
  finalize_activity_reminder: true,
};

// The unified message contract — what every channel ultimately delivers.
// Constructed outside the channel (typically via helpers in ./messages.ts)
// and passed in as opaque content the channel only formats for transport.
export type NotificationMeta = {
  title: string;
  body: string;
  // Where the click handler navigates. Absolute or origin-relative.
  link?: string;
  // Optional dedup key. Channels that support it (web-push) replace earlier
  // notifications with the same tag instead of stacking.
  tag?: string;
};

// What callers pass to notify() / broadcast(). Bundles the kind (for prefs
// filtering) with the rendered meta (for delivery).
export type NotificationDispatch = {
  kind: NotificationKind;
  meta: NotificationMeta;
};

export type SendResult = {
  channel: ChannelId;
  attempted: number;
  delivered: number;
  removed: number; // stale subscriptions cleaned up
};

export interface Channel {
  id: ChannelId;
  send(userEmail: string, meta: NotificationMeta): Promise<SendResult>;
}
