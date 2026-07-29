import { randomUUID } from "crypto";

export type PromotionPollType =
  | "member_to_intern"
  | "intern_to_qualified";

export type PromotionPollInput = {
  title: string;
  description: string;
  kind: "approval";
  audienceMode: "explicit_list";
  scope: null;
  status: "open";
  anonymous: false;
  feedbackPolicy: "required_on_reject";
  creatorType: "system";
  allowOther: false;
  autoSettle: true;
  minimumParticipationBps: number;
  minimumApprovalBps: number;
  deadline: Date;
  createdByEmail: null;
  options: Array<{
    label: string;
    semanticKey: "approve" | "reject";
    sortOrder: number;
  }>;
  electorate: Array<{ voterEmail: string }>;
};

export function buildPromotionPollInput(input: {
  type: PromotionPollType;
  candidateEmail: string;
  voterEmails: string[];
  deadline: Date;
  approvalRatioPercent: number;
}): PromotionPollInput {
  const target =
    input.type === "member_to_intern"
      ? "Intern Manager"
      : "Qualified Manager";
  return {
    title: `Promotion review: ${input.candidateEmail} → ${target}`,
    description: `Review ${input.candidateEmail}'s promotion application and record your decision.`,
    kind: "approval",
    audienceMode: "explicit_list",
    scope: null,
    status: "open",
    anonymous: false,
    feedbackPolicy: "required_on_reject",
    creatorType: "system",
    allowOther: false,
    autoSettle: true,
    minimumParticipationBps:
      input.type === "member_to_intern" ? 10_000 : 0,
    minimumApprovalBps:
      input.type === "member_to_intern"
        ? 10_000
        : Math.round(input.approvalRatioPercent * 100),
    deadline: input.deadline,
    createdByEmail: null,
    options: [
      { label: "Approve", semanticKey: "approve", sortOrder: 0 },
      { label: "Reject", semanticKey: "reject", sortOrder: 1 },
    ],
    electorate: [...new Set(input.voterEmails)].map((voterEmail) => ({
      voterEmail,
    })),
  };
}

type PromotionPollDatabase = {
  $transaction<T>(
    callback: (transaction: {
      poll: {
        create(args: Record<string, unknown>): Promise<unknown>;
      };
      promotionRequest: {
        create(args: Record<string, unknown>): Promise<unknown>;
      };
    }) => Promise<T>,
  ): Promise<T>;
};

export async function createPromotionWithPoll(
  database: unknown,
  input: {
    type: PromotionPollType;
    candidateEmail: string;
    voterEmails: string[];
    deadline: Date;
    approvalRatioPercent: number;
    applicationText?: string | null;
    requestedAt?: Date;
  },
): Promise<{ promotionRequest: unknown; poll: unknown }> {
  const pollId = randomUUID();
  const promotionRequestId = randomUUID();
  const requestedAt = input.requestedAt ?? new Date();
  const pollInput = buildPromotionPollInput(input);

  return (database as PromotionPollDatabase).$transaction(
    async (transaction) => {
      const poll = await transaction.poll.create({
        data: {
          id: pollId,
          ...pollInput,
          publishedAt: requestedAt,
          options: { create: pollInput.options },
          electorate: { create: pollInput.electorate },
        },
        include: {
          options: { orderBy: { sortOrder: "asc" } },
          electorate: true,
        },
      });
      const promotionRequest = await transaction.promotionRequest.create({
        data: {
          id: promotionRequestId,
          userEmail: input.candidateEmail,
          type: input.type,
          status: "pending",
          applicationText: input.applicationText?.trim() || null,
          requestedAt,
          expiresAt: input.deadline,
          pollId,
        },
        include: { user: true, poll: true },
      });
      return { promotionRequest, poll };
    },
  );
}
