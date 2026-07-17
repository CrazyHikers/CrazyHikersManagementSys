import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const initialMigrationPath = resolve(
  process.cwd(),
  "prisma/migrations/20260716140000_add_polls/migration.sql",
);
const upgradeMigrationPath = resolve(
  process.cwd(),
  "prisma/migrations/20260717170000_upgrade_polls_for_promotions/migration.sql",
);

describe("poll database migrations", () => {
  it("keeps the already-published poll migration immutable", () => {
    const sql = readFileSync(initialMigrationPath, "utf8");

    expect(sql).toContain(
      "CREATE TYPE \"public\".\"PollScope\" AS ENUM ('member_plus', 'manager_plus', 'admin')",
    );
    expect(sql).not.toContain("intern_manager_plus");
    expect(sql).not.toContain("poll_electorate");
    expect(sql).not.toContain("promotion_requests_poll_id_key");
  });

  it("uses a data-preserving follow-up migration for the expanded poll engine", () => {
    expect(
      existsSync(upgradeMigrationPath),
      "the poll engine upgrade must be a new migration",
    ).toBe(true);

    const sql = readFileSync(upgradeMigrationPath, "utf8");

    expect(sql).toContain(
      "ALTER TYPE \"public\".\"PollScope\" RENAME VALUE 'manager_plus' TO 'qualified_manager_plus'",
    );
    expect(sql).toContain(
      "ALTER TYPE \"public\".\"PollScope\" ADD VALUE 'intern_manager_plus'",
    );
    expect(sql).not.toContain("DROP TYPE \"public\".\"PollScope\"");
    expect(sql).toContain("ADD COLUMN \"voter_email\" TEXT");
    expect(sql).toContain("ADD COLUMN \"poll_id\" TEXT NOT NULL");
    expect(sql).toContain("CREATE TABLE \"public\".\"poll_electorate\"");
    expect(sql).toContain("poll_ballots_poll_id_voter_email_key");
    expect(sql).toContain("promotion_requests_poll_id_key");
  });

  it("deploys committed migrations instead of pushing schema during builds", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    ) as { scripts: { build: string } };

    expect(packageJson.scripts.build).toBe("prisma migrate deploy && next build");
  });
});
