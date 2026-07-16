import { describe, expect, it, vi } from "vitest";

vi.mock("./auth", () => ({ auth: vi.fn() }));

import { roleHasPermission } from "./permissions";

describe("poll permissions", () => {
  it.each(["member", "manager", "admin", "dev"] as const)(
    "allows %s to read and submit scoped polls",
    (role) => {
      expect(roleHasPermission(role, "polls.read")).toBe(true);
      expect(roleHasPermission(role, "polls.vote")).toBe(true);
    },
  );

  it.each([
    ["member", false],
    ["manager", false],
    ["admin", true],
    ["dev", true],
  ] as const)("maps %s poll management", (role, expected) => {
    expect(roleHasPermission(role, "polls.manage")).toBe(expected);
  });
});
