import { db } from "@/lib/db";
import type { PollOutcome, PollScope } from "./types";

type SettlementPoll = {
  id: string;
  kind: "choice" | "approval";
  autoSettle: boolean;
  audienceMode: "role_scope" | "explicit_list";
  scope: PollScope | null;
  status: "draft" | "open" | "closed";
  outcome: PollOutcome | null;
  minimumParticipationBps: number;
  minimumApprovalBps: number;
  promotion: { id: string } | null;
};

type SettlementTransaction = {
  poll: {
    findUnique(args: Record<string, unknown>): Promise<SettlementPoll | null>;
    updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
  };
  pollElectorate: {
    count(args: Record<string, unknown>): Promise<number>;
  };
  pollParticipation: {
    count(args: Record<string, unknown>): Promise<number>;
  };
  pollBallot: {
    count(args: Record<string, unknown>): Promise<number>;
  };
  user: {
    count(args: Record<string, unknown>): Promise<number>;
  };
  promotionRequest: {
    updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
  };
};

type SettlementDatabase = {
  $transaction<T>(
    callback: (transaction: SettlementTransaction) => Promise<T>,
  ): Promise<T>;
};

export function calculatePollOutcome(input: {
  eligible: number;
  cast: number;
  approve: number;
  participationBps: number;
  approvalBps: number;
}): PollOutcome {
  if (input.eligible <= 0 || input.cast <= 0) return "no_quorum";
  if (
    input.cast * 10_000 <
    input.eligible * input.participationBps
  ) {
    return "no_quorum";
  }
  return input.approve * 10_000 >= input.cast * input.approvalBps
    ? "passed"
    : "rejected";
}

export function pollScopeUserWhere(scope: PollScope): Record<string, unknown> {
  switch (scope) {
    case "member_plus":
      return { role: { in: ["member", "manager", "admin", "dev"] } };
    case "intern_manager_plus":
      return { role: { in: ["manager", "admin", "dev"] } };
    case "qualified_manager_plus":
      return {
        OR: [
          { role: { in: ["admin", "dev"] } },
          { role: "manager", managerProfile: { intern: false } },
        ],
      };
    case "admin":
      return { role: { in: ["admin", "dev"] } };
  }
}

async function eligibleCount(
  transaction: SettlementTransaction,
  poll: SettlementPoll,
): Promise<number> {
  if (poll.audienceMode === "explicit_list") {
    return transaction.pollElectorate.count({ where: { pollId: poll.id } });
  }
  if (!poll.scope) return 0;
  return transaction.user.count({ where: pollScopeUserWhere(poll.scope) });
}

function promotionTransition(outcome: PollOutcome) {
  if (outcome === "passed") {
    return { status: "pending_admin_review", resolvedAt: null };
  }
  return {
    status: outcome === "rejected" ? "rejected" : "expired",
    resolvedAt: new Date(),
  };
}

export async function settlePoll(
  database: unknown,
  pollId: string,
  now = new Date(),
): Promise<{
  changed: boolean;
  outcome: PollOutcome | null;
  promotionId?: string;
}> {
  return (database as SettlementDatabase).$transaction(async (transaction) => {
    const poll = await transaction.poll.findUnique({
      where: { id: pollId },
      select: {
        id: true,
        kind: true,
        autoSettle: true,
        audienceMode: true,
        scope: true,
        status: true,
        outcome: true,
        minimumParticipationBps: true,
        minimumApprovalBps: true,
        promotion: { select: { id: true } },
      },
    });
    if (!poll) return { changed: false, outcome: null };
    if (poll.outcome) {
      return { changed: false, outcome: poll.outcome };
    }
    if (poll.kind !== "approval" || !poll.autoSettle || poll.status !== "open") {
      return { changed: false, outcome: null };
    }

    const [eligible, cast, approve] = await Promise.all([
      eligibleCount(transaction, poll),
      transaction.pollParticipation.count({ where: { pollId } }),
      transaction.pollBallot.count({
        where: { pollId, option: { semanticKey: "approve" } },
      }),
    ]);
    const outcome = calculatePollOutcome({
      eligible,
      cast,
      approve,
      participationBps: poll.minimumParticipationBps,
      approvalBps: poll.minimumApprovalBps,
    });
    const updated = await transaction.poll.updateMany({
      where: {
        id: pollId,
        kind: "approval",
        autoSettle: true,
        status: "open",
        outcome: null,
      },
      data: {
        status: "closed",
        outcome,
        closedAt: now,
        settledAt: now,
      },
    });
    if (updated.count === 0) {
      return { changed: false, outcome };
    }

    if (poll.promotion) {
      const transition = promotionTransition(outcome);
      await transaction.promotionRequest.updateMany({
        where: { id: poll.promotion.id, status: "pending" },
        data: {
          ...transition,
          ...(outcome === "passed" ? {} : { resolvedAt: now }),
        },
      });
    }
    return {
      changed: true,
      outcome,
      ...(poll.promotion ? { promotionId: poll.promotion.id } : {}),
    };
  });
}

export const prismaSettlementDatabase = db;
