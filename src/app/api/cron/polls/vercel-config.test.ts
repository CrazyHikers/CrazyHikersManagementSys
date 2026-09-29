import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type VercelConfig = {
  crons?: Array<{ path: string; schedule: string }>;
};

describe("Vercel poll settlement schedule", () => {
  it("schedules the live poll cron route instead of the retired promotion route", () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"),
    ) as VercelConfig;
    const paths = config.crons?.map((cron) => cron.path) ?? [];

    expect(paths).toContain("/api/cron/polls");
    expect(paths).not.toContain("/api/cron/promotions");
  });
});
