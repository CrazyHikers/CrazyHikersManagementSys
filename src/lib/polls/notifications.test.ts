import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));

import { notifyPollAudience } from "./notifications";

describe("notifyPollAudience", () => {
  it.each([
    "member_plus",
    "intern_manager_plus",
    "qualified_manager_plus",
    "admin",
  ] as const)("resolves the %s role scope once", async (scope) => {
    const findRoleScopeUsers = vi.fn(async () => [
      { email: "one@example.com" },
      { email: "two@example.com" },
    ]);
    const findElectorateUsers = vi.fn();
    const send = vi.fn(async () => undefined);

    await notifyPollAudience(
      { findRoleScopeUsers, findElectorateUsers, send, logError: vi.fn() },
      {
        id: "p1",
        title: "Policy",
        audienceMode: "role_scope",
        scope,
      },
    );

    expect(findRoleScopeUsers).toHaveBeenCalledWith(scope);
    expect(findElectorateUsers).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("notifies exactly the explicit electorate without a role query", async () => {
    const findRoleScopeUsers = vi.fn();
    const findElectorateUsers = vi.fn(async () => [
      { email: "qualified@example.com" },
      { email: "qualified@example.com" },
      { email: "admin@example.com" },
    ]);
    const send = vi.fn(async () => undefined);

    await notifyPollAudience(
      { findRoleScopeUsers, findElectorateUsers, send, logError: vi.fn() },
      {
        id: "promotion-poll",
        title: "Promotion",
        audienceMode: "explicit_list",
        scope: null,
      },
    );

    expect(findElectorateUsers).toHaveBeenCalledWith("promotion-poll");
    expect(findRoleScopeUsers).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith(
      "qualified@example.com",
      expect.objectContaining({
        kind: "poll_published",
        meta: expect.objectContaining({
          link: "/dashboard/polls/promotion-poll",
        }),
      }),
    );
  });

  it("attempts each recipient once and never retries failures", async () => {
    const failure = new Error("channel failed");
    const send = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(undefined);
    const logError = vi.fn();

    const result = await notifyPollAudience(
      {
        findRoleScopeUsers: vi.fn(async () => [
          { email: "broken@example.com" },
          { email: "working@example.com" },
        ]),
        findElectorateUsers: vi.fn(),
        send,
        logError,
      },
      {
        id: "p1",
        title: "Policy",
        audienceMode: "role_scope",
        scope: "member_plus",
      },
    );

    expect(send).toHaveBeenCalledTimes(2);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ attempted: 2, failed: 1 });
  });
});
