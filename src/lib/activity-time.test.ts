import { expect, it } from "vitest";
import { formatActivityDeadline } from "./activity-time";

it.each(["en", "zh"])("keeps 17:00 Swiss time in both summer and winter (%s)", (locale) => {
  expect(formatActivityDeadline("2026-09-02T15:00:00Z", locale)).toContain("17:00");
  expect(formatActivityDeadline("2026-01-02T16:00:00Z", locale)).toContain("17:00");
});

it("uses the deadline's offset across the spring clock change", () => {
  expect(formatActivityDeadline("2026-03-29T00:30:00Z", "en")).toContain("01:30");
  expect(formatActivityDeadline("2026-03-29T01:30:00Z", "en")).toContain("03:30");
});

it("distinguishes repeated local times when the clock moves back", () => {
  const summer = formatActivityDeadline("2026-10-25T00:30:00Z", "en");
  const winter = formatActivityDeadline("2026-10-25T01:30:00Z", "en");
  expect(summer).toContain("02:30");
  expect(winter).toContain("02:30");
  expect(summer).not.toBe(winter);
});
