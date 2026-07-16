import { db } from "@/lib/db";
import {
  effectivePollStatus,
  validatePollInput,
} from "./rules";
import type { NormalizedPollInput, PollScope, PollStatus } from "./types";

export type PollServiceErrorCode =
  | "POLL_NOT_FOUND"
  | "POLL_LOCKED"
  | "POLL_NOT_DRAFT"
  | "POLL_CLOSED"
  | "DEADLINE_PASSED"
  | "INVALID_DEADLINE_EXTENSION";

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
  sortOrder: number;
};

export type StoredPoll = {
  id: string;
  title: string;
  description: string;
  scope: PollScope;
  status: PollStatus;
  allowOther: boolean;
  deadline: Date;
  createdByEmail: string;
  publishedAt: Date | null;
  closedAt: Date | null;
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
        scope: PollScope;
        allowOther: boolean;
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
  auditLog: {
    create(args: { data: AuditData }): Promise<unknown>;
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
  _now = new Date(),
): Promise<StoredPoll> {
  const normalized = validatePollInput(input);

  return asDatabase(database).$transaction(async (transaction) => {
    const poll = await transaction.poll.create({
      data: {
        title: normalized.title,
        description: normalized.description,
        scope: normalized.scope,
        allowOther: normalized.allowOther,
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
        scope: normalized.scope,
        allowOther: normalized.allowOther,
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

export const prismaPollDatabase = db;
