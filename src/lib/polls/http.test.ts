import { describe, expect, it } from "vitest";
import { PollValidationError } from "./rules";
import { PollServiceError } from "./service";
import { pollErrorStatus } from "./http";

describe("pollErrorStatus", () => {
  it("maps validation failures to 400", () => {
    expect(pollErrorStatus(new PollValidationError("title", "bad"))).toBe(400);
  });

  it.each([
    ["POLL_NOT_FOUND", 404],
    ["POLL_LOCKED", 409],
    ["POLL_NOT_DRAFT", 409],
    ["POLL_CLOSED", 409],
    ["DEADLINE_PASSED", 409],
    ["INVALID_DEADLINE_EXTENSION", 400],
    ["FORBIDDEN", 403],
    ["ALREADY_VOTED", 409],
  ] as const)("maps %s", (code, status) => {
    expect(pollErrorStatus(new PollServiceError(code, "error"))).toBe(status);
  });

  it("maps unknown failures to 500", () => {
    expect(pollErrorStatus(new Error("unknown"))).toBe(500);
  });
});
