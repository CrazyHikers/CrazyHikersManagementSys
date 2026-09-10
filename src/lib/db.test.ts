import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: class {} }));
vi.mock("@/generated/prisma/client", () => ({
  PrismaClient: class { constructor(options: unknown) { mocks.create(options); } },
}));

it("excludes the private album from activity reads by default, including public API reads", async () => {
  await import("./db");
  expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
    omit: { activity: { recapAlbumUrl: true } },
  }));
});
