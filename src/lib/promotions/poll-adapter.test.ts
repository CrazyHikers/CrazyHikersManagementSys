import { describe, expect, it } from "vitest";
import { buildPromotionPollInput } from "./poll-adapter";

const deadline = new Date("2026-08-01T12:00:00.000Z");

describe("buildPromotionPollInput", () => {
  it("creates a unanimous named referral poll", () => {
    const result = buildPromotionPollInput({
      type: "member_to_intern",
      candidateEmail: "member@example.com",
      voterEmails: ["one@example.com", "two@example.com"],
      deadline,
      approvalRatioPercent: 67,
    });

    expect(result).toMatchObject({
      creatorType: "system",
      audienceMode: "explicit_list",
      scope: null,
      kind: "approval",
      anonymous: false,
      feedbackPolicy: "required_on_reject",
      autoSettle: true,
      minimumParticipationBps: 10_000,
      minimumApprovalBps: 10_000,
      options: [
        { semanticKey: "approve", sortOrder: 0 },
        { semanticKey: "reject", sortOrder: 1 },
      ],
      electorate: [
        { voterEmail: "one@example.com" },
        { voterEmail: "two@example.com" },
      ],
    });
  });

  it("uses the configured approval ratio for qualified-manager promotion", () => {
    const result = buildPromotionPollInput({
      type: "intern_to_qualified",
      candidateEmail: "intern@example.com",
      voterEmails: ["qualified@example.com"],
      deadline,
      approvalRatioPercent: 67,
    });

    expect(result.minimumParticipationBps).toBe(0);
    expect(result.minimumApprovalBps).toBe(6700);
  });

  it("deduplicates the explicit electorate", () => {
    const result = buildPromotionPollInput({
      type: "intern_to_qualified",
      candidateEmail: "intern@example.com",
      voterEmails: ["one@example.com", "one@example.com"],
      deadline,
      approvalRatioPercent: 50,
    });

    expect(result.electorate).toEqual([{ voterEmail: "one@example.com" }]);
  });
});
