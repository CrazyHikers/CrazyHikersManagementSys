import { describe, expect, it } from "vitest";
import {
  PollValidationError,
  aggregatePollResults,
  canRoleAccessScope,
  effectivePollStatus,
  validateBallotInput,
  validatePollInput,
} from "./rules";

describe("canRoleAccessScope", () => {
  it.each([
    ["member", "member_plus", true],
    ["member", "manager_plus", false],
    ["member", "admin", false],
    ["manager", "member_plus", true],
    ["manager", "manager_plus", true],
    ["manager", "admin", false],
    ["admin", "admin", true],
    ["dev", "admin", true],
  ] as const)("maps %s to %s", (role, scope, expected) => {
    expect(canRoleAccessScope(role, scope)).toBe(expected);
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
    scope: "member_plus",
    deadline: "2026-07-20T12:00:00.000Z",
    allowOther: true,
    options: [" Yes ", "No"],
  };

  it("normalizes a valid custom poll", () => {
    expect(validatePollInput(validInput)).toEqual({
      title: "Policy",
      description: "Details",
      scope: "member_plus",
      deadline: new Date("2026-07-20T12:00:00.000Z"),
      allowOther: true,
      options: ["Yes", "No"],
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
    });
  });

  it("accepts and trims one enabled other response", () => {
    expect(validateBallotInput({ otherText: " New idea " }, poll)).toEqual({
      optionId: null,
      otherText: "New idea",
    });
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
