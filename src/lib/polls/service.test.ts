import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import {
  PollServiceError,
  closePoll,
  createPoll,
  publishPoll,
  updatePoll,
} from "./service";

const NOW = new Date("2026-07-16T12:00:00.000Z");

type FakeOption = {
  id: string;
  pollId: string;
  label: string;
  sortOrder: number;
};

type FakePoll = {
  id: string;
  title: string;
  description: string;
  scope: "member_plus" | "manager_plus" | "admin";
  status: "draft" | "open" | "closed";
  allowOther: boolean;
  deadline: Date;
  createdByEmail: string;
  publishedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  options: FakeOption[];
};

function draftPoll(overrides: Partial<FakePoll> = {}): FakePoll {
  return {
    id: "p1",
    title: "Policy",
    description: "Details",
    scope: "member_plus",
    status: "draft",
    allowOther: true,
    deadline: new Date("2026-07-20T12:00:00.000Z"),
    createdByEmail: "admin@example.com",
    publishedAt: null,
    closedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    options: [
      { id: "o1", pollId: "p1", label: "Yes", sortOrder: 0 },
      { id: "o2", pollId: "p1", label: "No", sortOrder: 1 },
    ],
    ...overrides,
  };
}

function makeDatabase(initialPoll?: FakePoll) {
  let poll = initialPoll;
  const auditRows: Array<Record<string, unknown>> = [];
  let optionSequence = 0;

  const tx = {
    poll: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const optionCreate = (
          data.options as { create: Array<{ label: string; sortOrder: number }> }
        ).create;
        poll = draftPoll({
          ...(data as Pick<
            FakePoll,
            | "title"
            | "description"
            | "scope"
            | "allowOther"
            | "deadline"
            | "createdByEmail"
          >),
          id: "p1",
          options: optionCreate.map((option) => ({
            id: `new-${optionSequence++}`,
            pollId: "p1",
            ...option,
          })),
        });
        return poll;
      }),
      findUnique: vi.fn(async () => poll ?? null),
      update: vi.fn(
        async ({ data }: { data: Record<string, unknown> }) => {
          if (!poll) throw new Error("missing fake poll");
          poll = { ...poll, ...data, updatedAt: NOW } as FakePoll;
          return poll;
        },
      ),
    },
    pollOption: {
      deleteMany: vi.fn(async () => {
        if (poll) poll.options = [];
      }),
      createMany: vi.fn(
        async ({ data }: { data: Array<{ pollId: string; label: string; sortOrder: number }> }) => {
          if (!poll) throw new Error("missing fake poll");
          poll.options = data.map((option) => ({
            id: `new-${optionSequence++}`,
            ...option,
          }));
        },
      ),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        auditRows.push(data);
        return data;
      }),
    },
  };

  const database = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };

  return {
    database,
    auditRows,
    get poll() {
      return poll;
    },
  };
}

const validInput = {
  title: " Policy ",
  description: " Details ",
  scope: "member_plus",
  deadline: "2026-07-20T12:00:00.000Z",
  allowOther: true,
  options: [" Yes ", "No"],
};

describe("poll lifecycle service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates ordered options and a create audit row", async () => {
    const fake = makeDatabase();

    const poll = await createPoll(
      fake.database,
      "admin@example.com",
      validInput,
    );

    expect(poll.options.map((option) => option.sortOrder)).toEqual([0, 1]);
    expect(fake.auditRows).toContainEqual(
      expect.objectContaining({
        entityType: "poll",
        entityId: "p1",
        action: "create",
        performedBy: "admin@example.com",
      }),
    );
  });

  it("publishes a valid draft and records the transition", async () => {
    const fake = makeDatabase(draftPoll());

    const poll = await publishPoll(
      fake.database,
      "admin@example.com",
      "p1",
      NOW,
    );

    expect(poll).toMatchObject({ status: "open", publishedAt: NOW });
    expect(fake.auditRows.at(-1)).toMatchObject({
      entityType: "poll",
      action: "status_change",
      oldValues: { status: "draft" },
      newValues: { status: "open" },
    });
  });

  it("rejects publishing when the deadline is not in the future", async () => {
    const fake = makeDatabase(draftPoll({ deadline: NOW }));

    await expect(
      publishPoll(fake.database, "admin@example.com", "p1", NOW),
    ).rejects.toMatchObject({ code: "DEADLINE_PASSED" });
  });

  it("locks poll content after publication", async () => {
    const fake = makeDatabase(draftPoll({ status: "open", publishedAt: NOW }));

    await expect(
      updatePoll(
        fake.database,
        "admin@example.com",
        "p1",
        { ...validInput, title: "Changed" },
        NOW,
      ),
    ).rejects.toMatchObject({ code: "POLL_LOCKED" });
  });

  it("allows only a strict deadline extension while open", async () => {
    const fake = makeDatabase(draftPoll({ status: "open", publishedAt: NOW }));

    const updated = await updatePoll(
      fake.database,
      "admin@example.com",
      "p1",
      { deadline: "2026-07-21T12:00:00.000Z" },
      NOW,
    );

    expect(updated.deadline).toEqual(new Date("2026-07-21T12:00:00.000Z"));
    await expect(
      updatePoll(
        fake.database,
        "admin@example.com",
        "p1",
        { deadline: "2026-07-19T12:00:00.000Z" },
        NOW,
      ),
    ).rejects.toMatchObject({ code: "INVALID_DEADLINE_EXTENSION" });
  });

  it("closes an open poll and never reopens it", async () => {
    const fake = makeDatabase(draftPoll({ status: "open", publishedAt: NOW }));
    const closed = await closePoll(
      fake.database,
      "admin@example.com",
      "p1",
      NOW,
    );
    expect(closed).toMatchObject({ status: "closed", closedAt: NOW });

    await expect(
      publishPoll(fake.database, "admin@example.com", "p1", NOW),
    ).rejects.toBeInstanceOf(PollServiceError);
  });
});
