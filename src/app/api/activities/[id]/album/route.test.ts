import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), findFirst: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: { registration: { findFirst: mocks.findFirst } } }));
import { GET } from "./route";
const context = { params: Promise.resolve({ id: "hike" }) };
beforeEach(() => { vi.clearAllMocks(); });

it("never queries album data for anonymous visitors", async () => {
  mocks.auth.mockResolvedValue(null);
  const response = await GET(new Request("https://example.com"), context);
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ albumUrl: null });
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(mocks.findFirst).not.toHaveBeenCalled();
});

it.each(["absent", "registration_confirmed", "registered", "attended"])("only returns links for attendance, not %s alone", async (status) => {
  mocks.auth.mockResolvedValue({ user: { email: "member@example.com", role: "member" } });
  mocks.findFirst.mockImplementation(async ({ where }) =>
    where.status === status ? { activity: { album: { url: "https://private.example/album" } } } : null);
  const response = await GET(new Request("https://example.com"), context);
  expect(await response.json()).toEqual({ albumUrl: status === "attended" ? "https://private.example/album" : null });
  expect(mocks.findFirst.mock.calls[0][0].where).toEqual({ activityId: "hike", userEmail: "member@example.com", status: "attended", activity: { status: "completed" } });
  expect(response.headers.get("cache-control")).toContain("no-store");
});
