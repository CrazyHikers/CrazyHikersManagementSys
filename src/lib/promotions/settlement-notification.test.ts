import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendPromotionResultEmail } = vi.hoisted(() => ({
  sendPromotionResultEmail: vi.fn(),
}));
vi.mock("@/lib/email", () => ({ sendPromotionResultEmail }));

import { notifyPromotionSettlement } from "./settlement-notification";

describe("notifyPromotionSettlement", () => {
  beforeEach(() => sendPromotionResultEmail.mockReset());

  it("sends de-identified reject feedback only for the winning settlement", async () => {
    const database = {
      promotionRequest: {
        findUnique: vi.fn(async () => ({
          userEmail: "candidate@example.com",
          user: { name: "Candidate" },
          poll: {
            ballots: [
              { feedback: "Needs more field experience" },
              { feedback: null },
            ],
          },
        })),
      },
    };

    await notifyPromotionSettlement(database, {
      changed: true,
      outcome: "rejected",
      promotionId: "promotion-1",
    });

    expect(sendPromotionResultEmail).toHaveBeenCalledWith(
      "candidate@example.com",
      "Candidate",
      false,
      "",
      ["Needs more field experience"],
    );
    expect(JSON.stringify(sendPromotionResultEmail.mock.calls)).not.toContain(
      "voterEmail",
    );
  });

  it("does nothing for a losing or passed settlement", async () => {
    const database = {
      promotionRequest: { findUnique: vi.fn() },
    };
    await notifyPromotionSettlement(database, {
      changed: false,
      outcome: "rejected",
      promotionId: "promotion-1",
    });
    await notifyPromotionSettlement(database, {
      changed: true,
      outcome: "passed",
      promotionId: "promotion-1",
    });
    expect(database.promotionRequest.findUnique).not.toHaveBeenCalled();
    expect(sendPromotionResultEmail).not.toHaveBeenCalled();
  });
});
