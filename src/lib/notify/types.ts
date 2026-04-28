// Channel-agnostic notification types.
//
// Adding a new channel (Discord, WeChat, etc.) means implementing the Channel
// interface and registering it in `./index.ts` — call sites stay unchanged.
// Adding a new event kind means extending NotificationKind + the
// NotificationPayload union, plus a row in NOTIFICATION_KINDS for UI/prefs.

export type ChannelId = "web-push";
// Future: | "discord" | "wechat";

export type NotificationKind =
  | "activity_created"
  | "registration_confirmed"
  | "test";

// User-toggleable kinds. `test` is excluded — it's only used for the
// confirmation push at subscribe time.
export const USER_TOGGLEABLE_KINDS = [
  "activity_created",
  "registration_confirmed",
] as const satisfies readonly NotificationKind[];

export type UserToggleableKind = (typeof USER_TOGGLEABLE_KINDS)[number];

export type NotificationPreferences = {
  activity_created?: boolean;
  registration_confirmed?: boolean;
};

// Default prefs for users who haven't customized — both kinds on. Means a
// freshly-subscribed device receives all kinds until the user opts out.
export const DEFAULT_PREFS: Required<NotificationPreferences> = {
  activity_created: true,
  registration_confirmed: true,
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
