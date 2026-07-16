import { describe, expect, it } from "vitest";
import {
  PollValidationError,
  aggregatePollResults,
  canActorAccessScope,
  effectivePollStatus,
  validateBallotInput,
  validatePollInput,
} from "./rules";

describe("canActorAccessScope", () => {
  const member = { role: "member", isIntern: false } as const;
  const intern = { role: "manager", isIntern: true } as const;
  const qualified = { role: "manager", isIntern: false } as const;
  const admin = { role: "admin", isIntern: false } as const;
  const dev = { role: "dev", isIntern: false } as const;

  it.each([
    [member, "member_plus", true],
    [member, "intern_manager_plus", false],
    [intern, "member_plus", true],
    [intern, "intern_manager_plus", true],
    [intern, "qualified_manager_plus", false],
    [qualified, "intern_manager_plus", true],
    [qualified, "qualified_manager_plus", true],
    [qualified, "admin", false],
    [admin, "qualified_manager_plus", true],
    [admin, "admin", true],
    [dev, "admin", true],
  ] as const)("maps actor %# to %s", (actor, scope, expected) => {
    expect(canActorAccessScope(actor, scope)).toBe(expected);
  });
});

describe("effectivePollStatus", () => {
  const now = new Date("2026-07-16T12:00:00.000Z");

  it("keeps a future open poll open", () => {
    expect(
      effectivePollStatus(
        "open",
        new Date("2026-07-16T12:00:00.001Z"),
        now,
      ),
    ).toBe("open");
  });

  it("closes an open poll exactly at its deadline", () => {
    expect(
      effectivePollStatus(
        "open",
        new Date("2026-07-16T12:00:00.000Z"),
        now,
      ),
    ).toBe("closed");
  });

  it("does not reopen explicit closed or draft polls", () => {
    const future = new Date("2026-07-20T12:00:00.000Z");
    expect(effectivePollStatus("closed", future, now)).toBe("closed");
    expect(effectivePollStatus("draft", future, now)).toBe("draft");
  });
});

describe("validatePollInput", () => {
  const validInput = {
    title: " Policy ",
    description: " Details ",
    kind: "choice",
    audienceMode: "role_scope",
    scope: "member_plus",
    anonymous: true,
    feedbackPolicy: "disabled",
    autoSettle: false,
    minimumParticipationBps: 0,
    minimumApprovalBps: 0,
    deadline: "2026-07-20T12:00:00.000Z",
    allowOther: true,
    options: [" Yes ", "No"],
  };

  it("normalizes a valid custom poll", () => {
    expect(validatePollInput(validInput)).toEqual({
      title: "Policy",
      description: "Details",
      kind: "choice",
      audienceMode: "role_scope",
      scope: "member_plus",
      anonymous: true,
      feedbackPolicy: "disabled",
      autoSettle: false,
      minimumParticipationBps: 0,
      minimumApprovalBps: 0,
      deadline: new Date("2026-07-20T12:00:00.000Z"),
      allowOther: true,
      options: ["Yes", "No"],
    });
  });

  it("accepts approval settlement and feedback configuration", () => {
    expect(
      validatePollInput({
        ...validInput,
        kind: "approval",
        scope: "qualified_manager_plus",
        anonymous: false,
        allowOther: false,
        feedbackPolicy: "required_on_reject",
        autoSettle: true,
        minimumParticipationBps: 5000,
        minimumApprovalBps: 6700,
        options: ["Approve", "Reject"],
      }),
    ).toMatchObject({
      kind: "approval",
      scope: "qualified_manager_plus",
      anonymous: false,
      feedbackPolicy: "required_on_reject",
      autoSettle: true,
      minimumParticipationBps: 5000,
      minimumApprovalBps: 6700,
    });
  });

  it.each([
    [{ ...validInput, title: "" }, "title"],
    [{ ...validInput, title: "x".repeat(121) }, "title"],
    [{ ...validInput, description: "x".repeat(4001) }, "description"],
    [{ ...validInput, scope: "guest" }, "scope"],
    [{ ...validInput, deadline: "not-a-date" }, "deadline"],
    [{ ...validInput, options: ["Only one"] }, "options"],
    [{ ...validInput, options: Array.from({ length: 11 }, (_, i) => `O${i}`) }, "options"],
    [{ ...validInput, options: ["Same", " same "] }, "options"],
    [{ ...validInput, options: ["A", "x".repeat(201)] }, "options"],
    [{ ...validInput, autoSettle: true }, "autoSettle"],
    [{ ...validInput, minimumApprovalBps: 10_001 }, "minimumApprovalBps"],
  ])("rejects an invalid %s input", (input, field) => {
    expect(() => validatePollInput(input)).toThrowError(
      expect.objectContaining({ field }),
    );
  });

  it("exposes a stable validation error type", () => {
    expect(() => validatePollInput({ ...validInput, title: "" })).toThrow(
      PollValidationError,
    );
  });
});

describe("validateBallotInput", () => {
  const poll = { allowOther: true, optionIds: ["a", "b"] };

  it("accepts one option owned by the poll", () => {
    expect(validateBallotInput({ optionId: "a" }, poll)).toEqual({
      optionId: "a",
      otherText: null,
      feedback: null,
    });
  });

  it("accepts and trims one enabled other response", () => {
    expect(validateBallotInput({ otherText: " New idea " }, poll)).toEqual({
      optionId: null,
      otherText: "New idea",
      feedback: null,
    });
  });

  it("applies every approval feedback policy", () => {
    expect(
      validateBallotInput(
        { optionId: "a", feedback: " Ready " },
        { ...poll, feedbackPolicy: "optional" },
      ),
    ).toEqual({ optionId: "a", otherText: null, feedback: "Ready" });
    expect(() =>
      validateBallotInput(
        { optionId: "a" },
        { ...poll, feedbackPolicy: "required" },
      ),
    ).toThrowError(expect.objectContaining({ field: "feedback" }));
    expect(
      validateBallotInput(
        { optionId: "a" },
        {
          ...poll,
          feedbackPolicy: "required_on_reject",
          rejectOptionId: "b",
        },
      ),
    ).toMatchObject({ feedback: null });
    expect(() =>
      validateBallotInput(
        { optionId: "b" },
        {
          ...poll,
          feedbackPolicy: "required_on_reject",
          rejectOptionId: "b",
        },
      ),
    ).toThrowError(expect.objectContaining({ field: "feedback" }));
    expect(() =>
      validateBallotInput(
        { optionId: "a", feedback: "not allowed" },
        { ...poll, feedbackPolicy: "disabled" },
      ),
    ).toThrowError(expect.objectContaining({ field: "feedback" }));
  });

  it.each([
    [{}, poll],
    [{ optionId: "a", otherText: "x" }, poll],
    [{ optionId: "foreign" }, poll],
    [{ otherText: "" }, poll],
    [{ otherText: "x".repeat(501) }, poll],
    [{ otherText: "idea" }, { ...poll, allowOther: false }],
  ])("rejects invalid ballot %#", (input, context) => {
    expect(() => validateBallotInput(input, context)).toThrow(
      PollValidationError,
    );
  });
});

describe("aggregatePollResults", () => {
  const options = [
    { id: "a", label: "A", sortOrder: 0 },
    { id: "b", label: "B", sortOrder: 1 },
  ];

  it("counts all ballots and preserves every other response", () => {
    expect(
      aggregatePollResults(options, [
        { optionId: "a", otherText: null },
        { optionId: "a", otherText: null },
        { optionId: null, otherText: "Idea" },
      ]),
    ).toEqual({
      total: 3,
      options: [
        { id: "a", label: "A", count: 2, percentage: 66.7 },
        { id: "b", label: "B", count: 0, percentage: 0 },
      ],
      other: { count: 1, percentage: 33.3, texts: ["Idea"] },
    });
  });

  it("returns zero percentages when no one voted", () => {
    expect(aggregatePollResults(options, [])).toEqual({
      total: 0,
      options: [
        { id: "a", label: "A", count: 0, percentage: 0 },
        { id: "b", label: "B", count: 0, percentage: 0 },
      ],
      other: { count: 0, percentage: 0, texts: [] },
    });
  });
});
