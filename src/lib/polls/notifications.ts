import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { pollPublishedDispatch } from "@/lib/notify/messages";
import type { NotificationDispatch } from "@/lib/notify/types";
import { rolesForPollScope } from "./rules";
import type { PollScope, UserRole } from "./types";

type PublishedPoll = {
  id: string;
  title: string;
  scope: PollScope | null;
};

type PollNotificationDependencies = {
  findUsers(roles: UserRole[]): Promise<Array<{ email: string }>>;
  send(email: string, dispatch: NotificationDispatch): Promise<unknown>;
  logError(error: unknown, email: string): void;
};

export async function notifyPollAudience(
  dependencies: PollNotificationDependencies,
  poll: PublishedPoll,
): Promise<{ attempted: number; failed: number }> {
  if (!poll.scope) return { attempted: 0, failed: 0 };
  const users = await dependencies.findUsers(rolesForPollScope(poll.scope));
  const dispatch = pollPublishedDispatch({
    pollId: poll.id,
    pollTitle: poll.title,
    url: `/dashboard/polls/${poll.id}`,
  });

  let failed = 0;
  for (const user of users) {
    try {
      await dependencies.send(user.email, dispatch);
    } catch (error) {
      failed += 1;
      dependencies.logError(error, user.email);
    }
  }

  return { attempted: users.length, failed };
}

export async function notifyPublishedPoll(poll: PublishedPoll) {
  return notifyPollAudience(
    {
      findUsers: async (roles) =>
        db.user.findMany({
          where: { role: { in: roles } },
          select: { email: true },
        }),
      send: notify,
      logError: (error, email) =>
        console.error("[polls] notification failed", { email, error }),
    },
    poll,
  );
}
