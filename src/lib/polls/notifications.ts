import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { pollPublishedDispatch } from "@/lib/notify/messages";
import type { NotificationDispatch } from "@/lib/notify/types";
import { pollScopeUserWhere } from "./settlement";
import type { PollAudienceMode, PollScope } from "./types";

export type PublishedPoll = {
  id: string;
  title: string;
  audienceMode: PollAudienceMode;
  scope: PollScope | null;
};

type PollNotificationDependencies = {
  findRoleScopeUsers(scope: PollScope): Promise<Array<{ email: string }>>;
  findElectorateUsers(pollId: string): Promise<Array<{ email: string }>>;
  send(email: string, dispatch: NotificationDispatch): Promise<unknown>;
  logError(error: unknown, email: string): void;
};

export async function notifyPollAudience(
  dependencies: PollNotificationDependencies,
  poll: PublishedPoll,
): Promise<{ attempted: number; failed: number }> {
  const users =
    poll.audienceMode === "explicit_list"
      ? await dependencies.findElectorateUsers(poll.id)
      : poll.scope
        ? await dependencies.findRoleScopeUsers(poll.scope)
        : [];
  const recipients = [
    ...new Map(users.map((user) => [user.email, user])).values(),
  ];
  const dispatch = pollPublishedDispatch({
    pollId: poll.id,
    pollTitle: poll.title,
    url: `/dashboard/polls/${poll.id}`,
  });

  let failed = 0;
  for (const user of recipients) {
    try {
      await dependencies.send(user.email, dispatch);
    } catch (error) {
      failed += 1;
      dependencies.logError(error, user.email);
    }
  }

  return { attempted: recipients.length, failed };
}

export async function notifyPublishedPoll(poll: PublishedPoll) {
  return notifyPollAudience(
    {
      findRoleScopeUsers: async (scope) =>
        db.user.findMany({
          where: pollScopeUserWhere(scope),
          select: { email: true },
        }),
      findElectorateUsers: async (pollId) =>
        (
          await db.pollElectorate.findMany({
            where: { pollId },
            select: { voterEmail: true },
          })
        ).map((row) => ({ email: row.voterEmail })),
      send: notify,
      logError: (error, email) =>
        console.error("[polls] notification failed", { email, error }),
    },
    poll,
  );
}
