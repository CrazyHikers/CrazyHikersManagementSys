// Channel-agnostic notification types.
//
// Adding a new channel (Discord, WeChat, etc.) means implementing the Channel
// interface and registering it in `./index.ts` — call sites stay unchanged.
// Adding a new event kind means extending NotificationKind + the
// NotificationPayload union, plus a row in MEMBER_KINDS or MANAGER_KINDS for
// the settings UI.

export type ChannelId = "web-push";
// Future: | "discord" | "wechat";

export type NotificationKind =
  | "activity_created"
  | "registration_confirmed"
  | "comanager_invited"
  | "comanager_response"
  | "confirm_registrations_reminder"
  | "finalize_activity_reminder"
  | "test";

// Toggleable kinds visible to all users (members + managers + admins).
export const MEMBER_KINDS = [
  "activity_created",
  "registration_confirmed",
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

// Default prefs for users who haven't customized — all kinds on. The
// manager-only kinds being on for a non-manager has no effect: the events
// that fire those kinds only target manager users.
export const DEFAULT_PREFS: Required<NotificationPreferences> = {
  activity_created: true,
  registration_confirmed: true,
  comanager_invited: true,
  comanager_response: true,
  confirm_registrations_reminder: true,
  finalize_activity_reminder: true,
};

// Channel-agnostic payload. Each channel formats this for its own transport
// (web push: JSON in 4KB; Discord: embed; WeChat: template message).
export type NotificationPayload =
  | {
      kind: "activity_created";
      activityId: string;
      activityTitle: string;
      url: string;
    }
  | {
      kind: "registration_confirmed";
      activityId: string;
      activityTitle: string;
      url: string;
    }
  | {
      kind: "comanager_invited";
      activityId: string;
      activityTitle: string;
      inviterName: string;
      url: string;
    }
  | {
      kind: "comanager_response";
      activityId: string;
      activityTitle: string;
      responderName: string;
      accepted: boolean;
      url: string;
    }
  | {
      kind: "confirm_registrations_reminder";
      activityId: string;
      activityTitle: string;
      pendingCount: number;
      url: string;
    }
  | {
      kind: "finalize_activity_reminder";
      activityId: string;
      activityTitle: string;
      url: string;
    }
  | {
      kind: "test";
      title: string;
      body: string;
      url?: string;
    };

export type SendResult = {
  channel: ChannelId;
  attempted: number;
  delivered: number;
  removed: number; // stale subscriptions cleaned up
};

export interface Channel {
  id: ChannelId;
  send(userEmail: string, payload: NotificationPayload): Promise<SendResult>;
}
