import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { calculatePollOutcome, settlePoll } from "./settlement";

const NOW = new Date("2026-07-17T12:00:00.000Z");

describe("calculatePollOutcome", () => {
  it.each([
    [
      { eligible: 10, cast: 0, approve: 0, participationBps: 0, approvalBps: 0 },
      "no_quorum",
    ],
    [
      { eligible: 10, cast: 4, approve: 4, participationBps: 5000, approvalBps: 5000 },
      "no_quorum",
    ],
    [
      { eligible: 10, cast: 5, approve: 2, participationBps: 5000, approvalBps: 5000 },
      "rejected",
    ],
    [
      { eligible: 10, cast: 5, approve: 3, participationBps: 5000, approvalBps: 6000 },
      "passed",
    ],
  ] as const)("settles threshold boundary %#", (input, expected) => {
    expect(calculatePollOutcome(input)).toBe(expected);
  });
});

describe("settlePoll", () => {
  it("applies a settlement and promotion transition only once", async () => {
    const poll = {
      id: "p1",
      kind: "approval",
      autoSettle: true,
      audienceMode: "explicit_list",
      scope: null,
      status: "open",
      outcome: null as "passed" | "rejected" | "no_quorum" | null,
      minimumParticipationBps: 5000,
      minimumApprovalBps: 6000,
      promotion: { id: "promotion-1" },
    };
    const promotionUpdates: Array<Record<string, unknown>> = [];
    const tx = {
      poll: {
        findUnique: vi.fn(async () => ({ ...poll })),
        updateMany: vi.fn(async ({ data }: { data: typeof poll }) => {
          if (poll.outcome !== null) return { count: 0 };
          Object.assign(poll, data);
          return { count: 1 };
        }),
      },
      pollElectorate: { count: vi.fn(async () => 5) },
      pollParticipation: { count: vi.fn(async () => 3) },
      pollBallot: { count: vi.fn(async () => 2) },
      user: { count: vi.fn(async () => 0) },
      promotionRequest: {
        updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          promotionUpdates.push(data);
          return { count: 1 };
        }),
      },
    };
    const database = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };

    const [first, second] = await Promise.all([
      settlePoll(database, "p1", NOW),
      settlePoll(database, "p1", NOW),
    ]);

    expect([first.changed, second.changed].sort()).toEqual([false, true]);
    expect(poll.outcome).toBe("passed");
    expect(promotionUpdates).toEqual([
      { status: "pending_admin_review", resolvedAt: null },
    ]);
  });
});
