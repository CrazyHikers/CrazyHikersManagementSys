// Per-kind dispatch builders. Each helper takes the structured event data,
// returns a NotificationDispatch (kind + meta) ready to pass to notify() or
// broadcast(). Keeps the bilingual copy in one place — channels never
// touch any of these strings.

import type { NotificationDispatch } from "./types";

const APP_TITLE = "Crazy Hikers";

// Date-stamped tag suffix for daily reminders so each day's reminder
// replaces the previous one on a device, but two consecutive days don't
// dedupe each other.
function todayTag(): string {
  return new Date().toISOString().slice(0, 10);
}

export function activityCreatedDispatch(opts: {
  activityId: string;
  activityTitle: string;
  url: string;
}): NotificationDispatch {
  return {
    kind: "activity_created",
    meta: {
      title: APP_TITLE,
      body: `新活动发布 / New activity: ${opts.activityTitle}`,
      link: opts.url,
      tag: `activity-created-${opts.activityId}`,
    },
  };
}

export function registrationConfirmedDispatch(opts: {
  activityId: string;
  activityTitle: string;
  url: string;
}): NotificationDispatch {
  return {
    kind: "registration_confirmed",
    meta: {
      title: APP_TITLE,
      body: `报名已确认 / Registration confirmed: ${opts.activityTitle}`,
      link: opts.url,
      tag: `activity-${opts.activityId}`,
    },
  };
}

export function pollPublishedDispatch(opts: {
  pollId: string;
  pollTitle: string;
  url: string;
}): NotificationDispatch {
  return {
    kind: "poll_published",
    meta: {
      title: APP_TITLE,
      body: `新投票发布 / New poll: ${opts.pollTitle}`,
      link: opts.url,
      tag: `poll-published-${opts.pollId}`,
    },
  };
}

export function comanagerInvitedDispatch(opts: {
  activityId: string;
  activityTitle: string;
  inviterName: string;
  url: string;
}): NotificationDispatch {
  return {
    kind: "comanager_invited",
    meta: {
      title: APP_TITLE,
      body: `${opts.inviterName} 邀请你副领 / invited you to co-manage: ${opts.activityTitle}`,
      link: opts.url,
      tag: `comanager-invite-${opts.activityId}`,
    },
  };
}

export function comanagerResponseDispatch(opts: {
  activityId: string;
  activityTitle: string;
  responderName: string;
  accepted: boolean;
  url: string;
}): NotificationDispatch {
  return {
    kind: "comanager_response",
    meta: {
      title: APP_TITLE,
      body: opts.accepted
        ? `${opts.responderName} 接受了副领邀请 / accepted co-manage invite: ${opts.activityTitle}`
        : `${opts.responderName} 拒绝了副领邀请 / declined co-manage invite: ${opts.activityTitle}`,
      link: opts.url,
      tag: `comanager-response-${opts.activityId}-${opts.responderName}`,
    },
  };
}

export function confirmRegistrationsReminderDispatch(opts: {
  activityId: string;
  activityTitle: string;
  pendingCount: number;
  url: string;
}): NotificationDispatch {
  return {
    kind: "confirm_registrations_reminder",
    meta: {
      title: APP_TITLE,
      body: `提醒：${opts.activityTitle} 还有 ${opts.pendingCount} 个待确认报名 / Reminder: ${opts.pendingCount} pending registration(s) to confirm`,
      link: opts.url,
      tag: `confirm-reminder-${opts.activityId}-${todayTag()}`,
    },
  };
}

export function finalizeActivityReminderDispatch(opts: {
  activityId: string;
  activityTitle: string;
  url: string;
}): NotificationDispatch {
  return {
    kind: "finalize_activity_reminder",
    meta: {
      title: APP_TITLE,
      body: `提醒：请将活动「${opts.activityTitle}」标记为完成或取消 / Reminder: please mark activity "${opts.activityTitle}" as finished or cancelled`,
      link: opts.url,
      tag: `finalize-reminder-${opts.activityId}-${todayTag()}`,
    },
  };
}
