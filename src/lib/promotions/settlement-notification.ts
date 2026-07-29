import { sendPromotionResultEmail } from "@/lib/email";
import type { PollOutcome } from "@/lib/polls/types";

type SettlementResult = {
  changed: boolean;
  outcome: PollOutcome | null;
  promotionId?: string;
};

type NotificationDatabase = {
  promotionRequest: {
    findUnique(args: Record<string, unknown>): Promise<{
      userEmail: string;
      user: { name: string };
      poll: { ballots: Array<{ feedback: string | null }> };
    } | null>;
  };
};

export async function notifyPromotionSettlement(
  database: unknown,
  result: SettlementResult,
): Promise<void> {
  if (
    !result.changed ||
    !result.promotionId ||
    !result.outcome ||
    result.outcome === "passed"
  ) {
    return;
  }

  const promotion = await (database as NotificationDatabase).promotionRequest.findUnique({
    where: { id: result.promotionId },
    select: {
      userEmail: true,
      user: { select: { name: true } },
      poll: {
        select: {
          ballots: {
            where: { option: { semanticKey: "reject" } },
            select: { feedback: true },
          },
        },
      },
    },
  });
  if (!promotion) return;

  const feedback = promotion.poll.ballots
    .map((ballot) => ballot.feedback?.trim())
    .filter((value): value is string => !!value);
  const reasons =
    result.outcome === "no_quorum"
      ? ["The voting period closed without quorum."]
      : feedback;

  await sendPromotionResultEmail(
    promotion.userEmail,
    promotion.user.name,
    false,
    "",
    reasons,
  );
}
