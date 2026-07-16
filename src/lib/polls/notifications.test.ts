import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));

import { notifyPollAudience } from "./notifications";

describe("notifyPollAudience", () => {
  it.each([
    ["member_plus", ["member", "manager", "admin", "dev"]],
    ["intern_manager_plus", ["manager", "admin", "dev"]],
    ["qualified_manager_plus", ["manager", "admin", "dev"]],
    ["admin", ["admin", "dev"]],
  ] as const)("selects %s recipients by current role", async (scope, roles) => {
    const findUsers = vi.fn(async () => [
      { email: "one@example.com" },
      { email: "two@example.com" },
    ]);
    const send = vi.fn(async () => undefined);

    await notifyPollAudience(
      { findUsers, send, logError: vi.fn() },
      { id: "p1", title: "Policy", scope },
    );

    expect(findUsers).toHaveBeenCalledWith([...roles]);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenNthCalledWith(
      1,
      "one@example.com",
      expect.objectContaining({
        kind: "poll_published",
        meta: expect.objectContaining({ link: "/dashboard/polls/p1" }),
      }),
    );
  });

  it("attempts each user once and never retries failures", async () => {
    const failure = new Error("channel failed");
    const send = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(undefined);
    const logError = vi.fn();

    const result = await notifyPollAudience(
      {
        findUsers: vi.fn(async () => [
          { email: "broken@example.com" },
          { email: "working@example.com" },
        ]),
        send,
        logError,
      },
      { id: "p1", title: "Policy", scope: "member_plus" },
    );

    expect(send).toHaveBeenCalledTimes(2);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ attempted: 2, failed: 1 });
  });
});
