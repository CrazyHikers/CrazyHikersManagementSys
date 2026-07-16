import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import {
  getPollDetail,
  listParticipants,
  listPolls,
  submitBallot,
} from "./service";

const NOW = new Date("2026-07-16T12:00:00.000Z");
const member = { email: "member@example.com", role: "member" as const };
const manager = { email: "manager@example.com", role: "manager" as const };
const admin = { email: "admin@example.com", role: "admin" as const };

function poll(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    title: "Policy",
    description: "Details",
    scope: "member_plus",
    status: "open",
    allowOther: true,
    deadline: new Date("2026-07-20T12:00:00.000Z"),
    createdByEmail: admin.email,
    publishedAt: NOW,
    closedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    options: [
      { id: "o1", pollId: "p1", label: "Yes", sortOrder: 0 },
      { id: "o2", pollId: "p1", label: "No", sortOrder: 1 },
    ],
    _count: { participations: 0 },
    participations: [],
    ...overrides,
  };
}

function makeVotingDatabase(initialPolls = [poll()]) {
  const polls = initialPolls;
  const participations: Array<{
    pollId: string;
    voterEmail: string;
    votedAt: Date;
  }> = [];
  const ballots: Array<{
    pollId: string;
    optionId: string | null;
    otherText: string | null;
  }> = [];

  const withViewerState = (stored: ReturnType<typeof poll>, email?: string) => ({
    ...stored,
    _count: {
      participations: participations.filter((item) => item.pollId === stored.id)
        .length,
    },
    participations: email
      ? participations.filter(
          (item) => item.pollId === stored.id && item.voterEmail === email,
        )
      : [],
  });

  const tx = {
    poll: {
      findUnique: vi.fn(
        async ({ where }: { where: { id: string } }) =>
          polls.find((item) => item.id === where.id) ?? null,
      ),
      findMany: vi.fn(async () => polls),
    },
    pollParticipation: {
      create: vi.fn(
        async ({ data }: { data: { pollId: string; voterEmail: string; votedAt: Date } }) => {
          if (
            participations.some(
              (item) =>
                item.pollId === data.pollId &&
                item.voterEmail === data.voterEmail,
            )
          ) {
            throw Object.assign(new Error("unique"), { code: "P2002" });
          }
          participations.push(data);
          return data;
        },
      ),
      findMany: vi.fn(async ({ where }: { where: { pollId: string } }) =>
        participations
          .filter(
            (item) =>
              (!("pollId" in where) || item.pollId === where.pollId) &&
              (!("voterEmail" in where) ||
                item.voterEmail === (where as { voterEmail: string }).voterEmail),
          )
          .map((item) => ({
            ...item,
            voter: {
              email: item.voterEmail,
              name: item.voterEmail.split("@")[0],
            },
          })),
      ),
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: {
            pollId_voterEmail: { pollId: string; voterEmail: string };
          };
        }) =>
          participations.find(
            (item) =>
              item.pollId === where.pollId_voterEmail.pollId &&
              item.voterEmail === where.pollId_voterEmail.voterEmail,
          ) ?? null,
      ),
    },
    pollBallot: {
      create: vi.fn(
        async ({ data }: { data: (typeof ballots)[number] }) => {
          ballots.push(data);
          return data;
        },
      ),
      findMany: vi.fn(async ({ where }: { where: { pollId: string } }) =>
        ballots.filter((item) => item.pollId === where.pollId),
      ),
    },
  };

  const database = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
    poll: {
      findMany: vi.fn(
        async ({ viewerEmail }: { viewerEmail?: string } = {}) =>
          polls.map((item) => withViewerState(item, viewerEmail)),
      ),
      findUnique: vi.fn(
        async ({ where, viewerEmail }: { where: { id: string }; viewerEmail?: string }) => {
          const stored = polls.find((item) => item.id === where.id);
          return stored ? withViewerState(stored, viewerEmail) : null;
        },
      ),
    },
    pollBallot: tx.pollBallot,
    pollParticipation: tx.pollParticipation,
  };

  return { database, participations, ballots };
}

describe("submitBallot", () => {
  it("writes identity and choice to separate tables in one transaction", async () => {
    const fake = makeVotingDatabase();

    await submitBallot(fake.database, member, "p1", { optionId: "o1" }, NOW);

    expect(fake.participations).toEqual([
      { pollId: "p1", voterEmail: member.email, votedAt: NOW },
    ]);
    expect(fake.ballots).toEqual([
      { pollId: "p1", optionId: "o1", otherText: null },
    ]);
    expect(fake.ballots[0]).not.toHaveProperty("voterEmail");
    expect(fake.ballots[0]).not.toHaveProperty("votedAt");
    expect(fake.database.$transaction).toHaveBeenCalledTimes(1);
  });

  it("rejects a duplicate without adding a second ballot", async () => {
    const fake = makeVotingDatabase();
    await submitBallot(fake.database, member, "p1", { optionId: "o1" }, NOW);

    await expect(
      submitBallot(fake.database, member, "p1", { optionId: "o2" }, NOW),
    ).rejects.toMatchObject({ code: "ALREADY_VOTED" });
    expect(fake.ballots).toHaveLength(1);
  });

  it("checks the actor's current role against scope", async () => {
    const fake = makeVotingDatabase([poll({ scope: "manager_plus" })]);
    await expect(
      submitBallot(fake.database, member, "p1", { optionId: "o1" }, NOW),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      submitBallot(fake.database, manager, "p1", { optionId: "o1" }, NOW),
    ).resolves.toEqual({ ok: true });
  });

  it.each([
    ["closed", new Date("2026-07-20T12:00:00.000Z")],
    ["open", NOW],
  ] as const)("rejects %s or naturally expired polls", async (status, deadline) => {
    const fake = makeVotingDatabase([poll({ status, deadline })]);
    await expect(
      submitBallot(fake.database, member, "p1", { optionId: "o1" }, NOW),
    ).rejects.toMatchObject({ code: "POLL_CLOSED" });
  });
});

describe("poll reads", () => {
  it("does not return tallies while a poll is open", async () => {
    const fake = makeVotingDatabase();
    await submitBallot(fake.database, member, "p1", { optionId: "o1" }, NOW);
    const detail = await getPollDetail(fake.database, admin, "p1", NOW);
    expect(detail).not.toHaveProperty("results");
    expect(detail.participantCount).toBe(1);
  });

  it("returns anonymous aggregate results once closed", async () => {
    const fake = makeVotingDatabase([poll({ status: "closed" })]);
    fake.ballots.push(
      { pollId: "p1", optionId: "o1", otherText: null },
      { pollId: "p1", optionId: null, otherText: "New idea" },
    );
    const detail = await getPollDetail(fake.database, member, "p1", NOW);
    expect(detail.results).toMatchObject({
      total: 2,
      other: { count: 1, texts: ["New idea"] },
    });
  });

  it("filters non-admin lists by dynamic scope and hides drafts", async () => {
    const fake = makeVotingDatabase([
      poll({ id: "member-open" }),
      poll({ id: "manager-open", scope: "manager_plus" }),
      poll({ id: "draft", status: "draft" }),
    ]);
    expect((await listPolls(fake.database, member, NOW)).map((item) => item.id)).toEqual([
      "member-open",
    ]);
    expect((await listPolls(fake.database, admin, NOW)).map((item) => item.id)).toEqual([
      "member-open",
      "manager-open",
      "draft",
    ]);
  });

  it("returns participant identity without any ballot fields", async () => {
    const fake = makeVotingDatabase();
    await submitBallot(fake.database, member, "p1", { otherText: "Idea" }, NOW);
    const participants = await listParticipants(fake.database, admin, "p1");
    expect(participants).toEqual([
      { email: member.email, name: "member", votedAt: NOW.toISOString() },
    ]);
    expect(participants[0]).not.toHaveProperty("optionId");
    expect(participants[0]).not.toHaveProperty("otherText");
  });
});
