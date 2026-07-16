import { db } from "@/lib/db";
import {
  aggregatePollResults,
  canActorAccessScope,
  effectivePollStatus,
  validateBallotInput,
  validatePollInput,
} from "./rules";
import type {
  NormalizedPollInput,
  PollActor,
  PollAudienceMode,
  PollCreatorType,
  PollDetailDTO,
  PollFeedbackPolicy,
  PollKind,
  PollListItemDTO,
  PollNamedBallotDTO,
  PollOutcome,
  PollParticipantDTO,
  PollScope,
  PollStatus,
} from "./types";

export type PollServiceErrorCode =
  | "POLL_NOT_FOUND"
  | "POLL_LOCKED"
  | "POLL_NOT_DRAFT"
  | "POLL_CLOSED"
  | "DEADLINE_PASSED"
  | "INVALID_DEADLINE_EXTENSION"
  | "FORBIDDEN"
  | "POLL_NOT_CLOSED"
  | "ANONYMOUS_POLL"
  | "ALREADY_VOTED";

export class PollServiceError extends Error {
  constructor(
    public readonly code: PollServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PollServiceError";
  }
}

type StoredOption = {
  id: string;
  pollId: string;
  label: string;
  semanticKey: "approve" | "reject" | null;
  sortOrder: number;
};

export type StoredPoll = {
  id: string;
  title: string;
  description: string;
  kind: PollKind;
  audienceMode: PollAudienceMode;
  scope: PollScope | null;
  status: PollStatus;
  anonymous: boolean;
  feedbackPolicy: PollFeedbackPolicy;
  creatorType: PollCreatorType;
  allowOther: boolean;
  autoSettle: boolean;
  minimumParticipationBps: number;
  minimumApprovalBps: number;
  outcome: PollOutcome | null;
  deadline: Date;
  createdByEmail: string | null;
  publishedAt: Date | null;
  closedAt: Date | null;
  settledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  options: StoredOption[];
};

type AuditData = {
  entityType: "poll";
  entityId: string;
  action: "create" | "update" | "status_change";
  performedBy: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
};

type PollTransaction = {
  poll: {
    create(args: {
      data: {
        title: string;
        description: string;
        kind: PollKind;
        audienceMode: PollAudienceMode;
        scope: PollScope;
        anonymous: boolean;
        feedbackPolicy: PollFeedbackPolicy;
        creatorType: PollCreatorType;
        allowOther: boolean;
        autoSettle: boolean;
        minimumParticipationBps: number;
        minimumApprovalBps: number;
        deadline: Date;
        createdByEmail: string;
        options: {
          create: Array<{ label: string; sortOrder: number }>;
        };
      };
      include: { options: { orderBy: { sortOrder: "asc" } } };
    }): Promise<StoredPoll>;
    findUnique(args: {
      where: { id: string };
      include: { options: { orderBy: { sortOrder: "asc" } } };
    }): Promise<StoredPoll | null>;
    update(args: {
      where: { id: string };
      data: Record<string, unknown>;
      include: { options: { orderBy: { sortOrder: "asc" } } };
    }): Promise<StoredPoll>;
  };
  pollOption: {
    deleteMany(args: { where: { pollId: string } }): Promise<unknown>;
    createMany(args: {
      data: Array<{
        pollId: string;
        label: string;
        sortOrder: number;
      }>;
    }): Promise<unknown>;
  };
  pollParticipation: {
    create(args: {
      data: { pollId: string; voterEmail: string; votedAt: Date };
    }): Promise<unknown>;
  };
  pollBallot: {
    create(args: {
      data: {
        pollId: string;
        optionId: string | null;
        otherText: string | null;
        feedback: string | null;
        voterEmail?: string;
      };
    }): Promise<unknown>;
  };
  pollElectorate: {
    findUnique(args: Record<string, unknown>): Promise<unknown | null>;
  };
  auditLog: {
    create(args: { data: AuditData }): Promise<unknown>;
  };
};

type PollReadRow = StoredPoll & {
  _count: { participations: number };
};

type PollReadDatabase = {
  poll: {
    findMany(args: Record<string, unknown>): Promise<PollReadRow[]>;
    findUnique(args: Record<string, unknown>): Promise<PollReadRow | null>;
  };
  pollParticipation: {
    findUnique(args: Record<string, unknown>): Promise<unknown | null>;
    findMany(args: Record<string, unknown>): Promise<
      Array<{
        pollId: string;
        voterEmail: string;
        votedAt: Date;
        voter?: { email: string; name: string };
      }>
    >;
  };
  pollBallot: {
    findMany(args: Record<string, unknown>): Promise<
      Array<{
        optionId: string | null;
        otherText: string | null;
        feedback?: string | null;
        voterEmail?: string | null;
        voter?: { email: string; name: string } | null;
        option?: {
          label: string;
          semanticKey: "approve" | "reject" | null;
        } | null;
      }>
    >;
  };
  pollElectorate: {
    findUnique(args: Record<string, unknown>): Promise<unknown | null>;
    findMany(args: Record<string, unknown>): Promise<Array<{ pollId: string }>>;
  };
};

type PollDatabase = {
  $transaction<T>(
    callback: (transaction: PollTransaction) => Promise<T>,
  ): Promise<T>;
};

const optionOrder = { options: { orderBy: { sortOrder: "asc" as const } } };

function asDatabase(database: unknown): PollDatabase {
  return database as PollDatabase;
}

function asReadDatabase(database: unknown): PollReadDatabase {
  return database as PollReadDatabase;
}

function isPollManager(actor: PollActor): boolean {
  return actor.role === "admin" || actor.role === "dev";
}

function canActorAccessRoleAudience(
  actor: PollActor,
  poll: Pick<StoredPoll, "audienceMode" | "scope">,
): boolean {
  return (
    poll.audienceMode !== "explicit_list" &&
    poll.scope !== null &&
    canActorAccessScope(actor, poll.scope)
  );
}

async function canActorAccessAudience(
  database: {
    pollElectorate: {
      findUnique(args: Record<string, unknown>): Promise<unknown | null>;
    };
  },
  actor: PollActor,
  poll: Pick<StoredPoll, "id" | "audienceMode" | "scope">,
): Promise<boolean> {
  if (poll.audienceMode !== "explicit_list") {
    return canActorAccessRoleAudience(actor, poll);
  }
  return !!(await database.pollElectorate.findUnique({
    where: {
      pollId_voterEmail: { pollId: poll.id, voterEmail: actor.email },
    },
    select: { pollId: true },
  }));
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function asObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return input as Record<string, unknown>;
}

function optionRows(input: NormalizedPollInput) {
  return input.options.map((label, sortOrder) => ({ label, sortOrder }));
}

async function audit(transaction: PollTransaction, data: AuditData) {
  await transaction.auditLog.create({ data });
}

export async function createPoll(
  database: unknown,
  actorEmail: string,
  input: unknown,
): Promise<StoredPoll> {
  const normalized = validatePollInput(input);

  return asDatabase(database).$transaction(async (transaction) => {
    const poll = await transaction.poll.create({
      data: {
        title: normalized.title,
        description: normalized.description,
        kind: normalized.kind,
        audienceMode: normalized.audienceMode,
        scope: normalized.scope,
        anonymous: normalized.anonymous,
        feedbackPolicy: normalized.feedbackPolicy,
        creatorType: "admin",
        allowOther: normalized.allowOther,
        autoSettle: normalized.autoSettle,
        minimumParticipationBps: normalized.minimumParticipationBps,
        minimumApprovalBps: normalized.minimumApprovalBps,
        deadline: normalized.deadline,
        createdByEmail: actorEmail,
        options: { create: optionRows(normalized) },
      },
      include: optionOrder,
    });
    await audit(transaction, {
      entityType: "poll",
      entityId: poll.id,
      action: "create",
      performedBy: actorEmail,
      newValues: {
        title: poll.title,
        scope: poll.scope,
        deadline: poll.deadline.toISOString(),
      },
    });
    return poll;
  });
}

export async function publishPoll(
  database: unknown,
  actorEmail: string,
  pollId: string,
  now = new Date(),
): Promise<StoredPoll> {
  return asDatabase(database).$transaction(async (transaction) => {
    const existing = await transaction.poll.findUnique({
      where: { id: pollId },
      include: optionOrder,
    });
    if (!existing) {
      throw new PollServiceError("POLL_NOT_FOUND", "Poll not found");
    }
    if (existing.status !== "draft") {
      throw new PollServiceError("POLL_NOT_DRAFT", "Only drafts can publish");
    }
    if (existing.deadline.getTime() <= now.getTime()) {
      throw new PollServiceError(
        "DEADLINE_PASSED",
        "Deadline must be in the future",
      );
    }

    const poll = await transaction.poll.update({
      where: { id: pollId },
      data: { status: "open", publishedAt: now },
      include: optionOrder,
    });
    await audit(transaction, {
      entityType: "poll",
      entityId: pollId,
      action: "status_change",
      performedBy: actorEmail,
      oldValues: { status: "draft" },
      newValues: { status: "open" },
    });
    return poll;
  });
}

export async function updatePoll(
  database: unknown,
  actorEmail: string,
  pollId: string,
  input: unknown,
  now = new Date(),
): Promise<StoredPoll> {
  return asDatabase(database).$transaction(async (transaction) => {
    const existing = await transaction.poll.findUnique({
      where: { id: pollId },
      include: optionOrder,
    });
    if (!existing) {
      throw new PollServiceError("POLL_NOT_FOUND", "Poll not found");
    }

    const status = effectivePollStatus(existing.status, existing.deadline, now);
    if (status === "closed") {
      throw new PollServiceError("POLL_CLOSED", "Poll is closed");
    }

    if (status === "open") {
      const value = asObject(input);
      if (Object.keys(value).length !== 1 || typeof value.deadline !== "string") {
        throw new PollServiceError(
          "POLL_LOCKED",
          "Only the deadline can change after publishing",
        );
      }
      const deadline = new Date(value.deadline);
      if (
        Number.isNaN(deadline.getTime()) ||
        deadline.getTime() <= now.getTime() ||
        deadline.getTime() <= existing.deadline.getTime()
      ) {
        throw new PollServiceError(
          "INVALID_DEADLINE_EXTENSION",
          "Deadline must strictly extend the open poll",
        );
      }
      const poll = await transaction.poll.update({
        where: { id: pollId },
        data: { deadline },
        include: optionOrder,
      });
      await audit(transaction, {
        entityType: "poll",
        entityId: pollId,
        action: "update",
        performedBy: actorEmail,
        oldValues: { deadline: existing.deadline.toISOString() },
        newValues: { deadline: deadline.toISOString() },
      });
      return poll;
    }

    const normalized = validatePollInput(input);
    await transaction.poll.update({
      where: { id: pollId },
      data: {
        title: normalized.title,
        description: normalized.description,
        kind: normalized.kind,
        audienceMode: normalized.audienceMode,
        scope: normalized.scope,
        anonymous: normalized.anonymous,
        feedbackPolicy: normalized.feedbackPolicy,
        allowOther: normalized.allowOther,
        autoSettle: normalized.autoSettle,
        minimumParticipationBps: normalized.minimumParticipationBps,
        minimumApprovalBps: normalized.minimumApprovalBps,
        deadline: normalized.deadline,
      },
      include: optionOrder,
    });
    await transaction.pollOption.deleteMany({ where: { pollId } });
    await transaction.pollOption.createMany({
      data: optionRows(normalized).map((option) => ({ pollId, ...option })),
    });
    const poll = await transaction.poll.findUnique({
      where: { id: pollId },
      include: optionOrder,
    });
    if (!poll) {
      throw new PollServiceError("POLL_NOT_FOUND", "Poll not found");
    }
    await audit(transaction, {
      entityType: "poll",
      entityId: pollId,
      action: "update",
      performedBy: actorEmail,
      oldValues: { title: existing.title, scope: existing.scope },
      newValues: { title: poll.title, scope: poll.scope },
    });
    return poll;
  });
}

export async function closePoll(
  database: unknown,
  actorEmail: string,
  pollId: string,
  now = new Date(),
): Promise<StoredPoll> {
  return asDatabase(database).$transaction(async (transaction) => {
    const existing = await transaction.poll.findUnique({
      where: { id: pollId },
      include: optionOrder,
    });
    if (!existing) {
      throw new PollServiceError("POLL_NOT_FOUND", "Poll not found");
    }
    if (effectivePollStatus(existing.status, existing.deadline, now) !== "open") {
      throw new PollServiceError("POLL_CLOSED", "Poll is not open");
    }
    const poll = await transaction.poll.update({
      where: { id: pollId },
      data: { status: "closed", closedAt: now },
      include: optionOrder,
    });
    await audit(transaction, {
      entityType: "poll",
      entityId: pollId,
      action: "status_change",
      performedBy: actorEmail,
      oldValues: { status: "open" },
      newValues: { status: "closed" },
    });
    return poll;
  });
}

export async function submitBallot(
  database: unknown,
  actor: PollActor,
  pollId: string,
  input: unknown,
  now = new Date(),
): Promise<{ ok: true }> {
  try {
    await asDatabase(database).$transaction(async (transaction) => {
      const poll = await transaction.poll.findUnique({
        where: { id: pollId },
        include: optionOrder,
      });
      if (!poll) {
        throw new PollServiceError("POLL_NOT_FOUND", "Poll not found");
      }
      if (!await canActorAccessAudience(transaction, actor, poll)) {
        throw new PollServiceError("FORBIDDEN", "Poll is outside current scope");
      }
      if (effectivePollStatus(poll.status, poll.deadline, now) !== "open") {
        throw new PollServiceError("POLL_CLOSED", "Poll is closed");
      }

      const ballot = validateBallotInput(input, {
        allowOther: poll.allowOther,
        optionIds: poll.options.map((option) => option.id),
        feedbackPolicy: poll.feedbackPolicy,
        rejectOptionId:
          poll.options.find((option) => option.semanticKey === "reject")?.id ??
          null,
      });
      await transaction.pollParticipation.create({
        data: { pollId, voterEmail: actor.email, votedAt: now },
      });
      await transaction.pollBallot.create({
        data: {
          pollId,
          ...ballot,
          ...(poll.anonymous ? {} : { voterEmail: actor.email }),
        },
      });
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new PollServiceError("ALREADY_VOTED", "User already voted");
    }
    throw error;
  }

  return { ok: true };
}

function toListItem(
  poll: PollReadRow,
  status: PollStatus,
  hasVoted: boolean,
): PollListItemDTO {
  return {
    id: poll.id,
    title: poll.title,
    description: poll.description,
    kind: poll.kind,
    audienceMode: poll.audienceMode,
    scope: poll.scope,
    status,
    anonymous: poll.anonymous,
    feedbackPolicy: poll.feedbackPolicy,
    creatorType: poll.creatorType,
    autoSettle: poll.autoSettle,
    minimumParticipationBps: poll.minimumParticipationBps,
    minimumApprovalBps: poll.minimumApprovalBps,
    outcome: poll.outcome,
    deadline: poll.deadline.toISOString(),
    participantCount: poll._count.participations,
    hasVoted,
    allowOther: poll.allowOther,
  };
}

async function votedPollIds(
  database: PollReadDatabase,
  actorEmail: string,
): Promise<Set<string>> {
  const rows = await database.pollParticipation.findMany({
    where: { voterEmail: actorEmail },
    select: { pollId: true },
  });
  return new Set(rows.map((row) => row.pollId));
}

export async function listPolls(
  database: unknown,
  actor: PollActor,
  now = new Date(),
): Promise<PollListItemDTO[]> {
  const reader = asReadDatabase(database);
  const [polls, voted] = await Promise.all([
    reader.poll.findMany({
      include: {
        options: { orderBy: { sortOrder: "asc" } },
        _count: { select: { participations: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    votedPollIds(reader, actor.email),
  ]);
  const electoratePollIds = new Set(
    (
      await reader.pollElectorate.findMany({
        where: { voterEmail: actor.email },
        select: { pollId: true },
      })
    ).map((row) => row.pollId),
  );

  return polls.flatMap((poll) => {
    const status = effectivePollStatus(poll.status, poll.deadline, now);
    if (!isPollManager(actor)) {
      const canAccess =
        poll.audienceMode === "explicit_list"
          ? electoratePollIds.has(poll.id)
          : canActorAccessRoleAudience(actor, poll);
      if (status === "draft" || !canAccess) {
        return [];
      }
    }
    return [toListItem(poll, status, voted.has(poll.id))];
  });
}

export async function getPollDetail(
  database: unknown,
  actor: PollActor,
  pollId: string,
  now = new Date(),
): Promise<PollDetailDTO> {
  const reader = asReadDatabase(database);
  const poll = await reader.poll.findUnique({
    where: { id: pollId },
    include: {
      options: { orderBy: { sortOrder: "asc" } },
      _count: { select: { participations: true } },
    },
  });
  if (!poll) {
    throw new PollServiceError("POLL_NOT_FOUND", "Poll not found");
  }

  const status = effectivePollStatus(poll.status, poll.deadline, now);
  if (
    !isPollManager(actor) &&
    (status === "draft" || !(await canActorAccessAudience(reader, actor, poll)))
  ) {
    throw new PollServiceError("FORBIDDEN", "Poll is outside current scope");
  }

  const participation = await reader.pollParticipation.findUnique({
    where: {
      pollId_voterEmail: { pollId, voterEmail: actor.email },
    },
    select: { pollId: true },
  });
  const detail: PollDetailDTO = {
    ...toListItem(poll, status, !!participation),
    options: poll.options.map((option) => ({
      id: option.id,
      label: option.label,
      sortOrder: option.sortOrder,
    })),
  };

  if (status === "closed") {
    const ballots = await reader.pollBallot.findMany({
      where: { pollId },
      select: { optionId: true, otherText: true },
    });
    detail.results = aggregatePollResults(poll.options, ballots);
  }
  return detail;
}

export async function listParticipants(
  database: unknown,
  actor: PollActor,
  pollId: string,
): Promise<PollParticipantDTO[]> {
  if (!isPollManager(actor)) {
    throw new PollServiceError("FORBIDDEN", "Only admins can view participants");
  }
  const reader = asReadDatabase(database);
  const poll = await reader.poll.findUnique({
    where: { id: pollId },
    include: {
      options: { orderBy: { sortOrder: "asc" } },
      _count: { select: { participations: true } },
    },
  });
  if (!poll) {
    throw new PollServiceError("POLL_NOT_FOUND", "Poll not found");
  }

  const rows = await reader.pollParticipation.findMany({
    where: { pollId },
    include: { voter: { select: { email: true, name: true } } },
    orderBy: { votedAt: "asc" },
  });
  return rows.map((row) => ({
    email: row.voter?.email ?? row.voterEmail,
    name: row.voter?.name ?? row.voterEmail,
    votedAt: row.votedAt.toISOString(),
  }));
}

export async function listNamedBallots(
  database: unknown,
  actor: PollActor,
  pollId: string,
  now = new Date(),
): Promise<PollNamedBallotDTO[]> {
  if (!isPollManager(actor)) {
    throw new PollServiceError(
      "FORBIDDEN",
      "Only admins can view named ballots",
    );
  }
  const reader = asReadDatabase(database);
  const poll = await reader.poll.findUnique({
    where: { id: pollId },
    include: {
      options: { orderBy: { sortOrder: "asc" } },
      _count: { select: { participations: true } },
    },
  });
  if (!poll) {
    throw new PollServiceError("POLL_NOT_FOUND", "Poll not found");
  }
  if (effectivePollStatus(poll.status, poll.deadline, now) !== "closed") {
    throw new PollServiceError(
      "POLL_NOT_CLOSED",
      "Named ballots are hidden until the poll closes",
    );
  }
  if (poll.anonymous) {
    throw new PollServiceError(
      "ANONYMOUS_POLL",
      "Anonymous polls have no named ballot details",
    );
  }

  const ballots = await reader.pollBallot.findMany({
    where: { pollId },
    include: {
      voter: { select: { email: true, name: true } },
      option: { select: { label: true, semanticKey: true } },
    },
  });
  return ballots.map((ballot) => ({
    email: ballot.voter?.email ?? ballot.voterEmail ?? "",
    name: ballot.voter?.name ?? ballot.voterEmail ?? "",
    optionLabel: ballot.option?.label ?? ballot.otherText ?? "",
    semanticKey: ballot.option?.semanticKey ?? null,
    feedback: ballot.feedback ?? null,
  }));
}

export const prismaPollDatabase = db;
