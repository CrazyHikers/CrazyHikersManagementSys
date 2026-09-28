import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(async () => []),
  settlePoll: vi.fn(),
  notifyPromotionSettlement: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { poll: { findMany: mocks.findMany } },
}));
vi.mock("@/lib/polls/settlement", () => ({
  settlePoll: mocks.settlePoll,
}));
vi.mock("@/lib/promotions/settlement-notification", () => ({
  notifyPromotionSettlement: mocks.notifyPromotionSettlement,
}));

import { GET } from "./route";

describe("poll settlement cron route", () => {
  it("accepts the GET request method used by Vercel Cron", async () => {
    const previousSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-secret";

    try {
      const request = new NextRequest("https://example.test/api/cron/polls", {
        headers: { authorization: "Bearer test-secret" },
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ processed: 0, settled: 0 });
    } finally {
      if (previousSecret === undefined) {
        delete process.env.CRON_SECRET;
      } else {
        process.env.CRON_SECRET = previousSecret;
      }
    }
  });
});
