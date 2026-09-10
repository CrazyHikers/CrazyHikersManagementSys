import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(), headObject: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/r2", () => ({ headObject: mocks.headObject }));
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag }));
vi.mock("@/lib/db", () => ({ db: {
  activity: { findUnique: mocks.findUnique },
  $transaction: async (fn: (tx: unknown) => unknown) => fn({ activity: { updateMany: mocks.updateMany }, activityAlbum: { upsert: mocks.upsert, deleteMany: mocks.deleteMany } }),
} }));
import { PUT } from "./route";
const date = new Date("2026-09-10T20:00:00Z");
const activity = { metadata: { route: "Alps", template: "audience_520" }, status: "completed", updatedAt: date, activityManagers: [{ userEmail: "guide@example.com", role: "manager", status: "confirmed" }] };
const body = { description: "A great day", albumUrl: "https://private.example/album", photoKeys: [], version: date.toISOString() };
function save(value: unknown = body) { return PUT(new Request("https://example.com", { method: "PUT", body: JSON.stringify(value) }), { params: Promise.resolve({ id: "hike" }) }); }
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { email: "guide@example.com", role: "manager" } });
  mocks.findUnique.mockResolvedValue(activity);
  mocks.updateMany.mockResolvedValue({ count: 1 });
});

it("stores public content and private album separately, retaining existing metadata", async () => {
  expect((await save()).status).toBe(200);
  expect(mocks.updateMany.mock.calls[0][0].data.metadata).toEqual({ ...activity.metadata, recap: { description: body.description, photoKeys: [] } });
  expect(JSON.stringify(mocks.updateMany.mock.calls)).not.toContain(body.albumUrl);
  expect(mocks.upsert.mock.calls[0][0].create).toEqual({ activityId: "hike", url: body.albumUrl });
  expect(mocks.revalidateTag).toHaveBeenCalledTimes(2);
});
it("allows clearing both public recap and private album", async () => {
  expect((await save({ ...body, description: "", albumUrl: "" })).status).toBe(200);
  expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { activityId: "hike" } });
});
it("rejects anonymous and unrelated managers", async () => {
  mocks.auth.mockResolvedValue(null);
  expect((await save()).status).toBe(401);
  mocks.auth.mockResolvedValue({ user: { email: "other@example.com", role: "manager" } });
  expect((await save()).status).toBe(403);
  expect(mocks.updateMany).not.toHaveBeenCalled();
});
it("rejects unfinished activities and stale edits", async () => {
  mocks.findUnique.mockResolvedValue({ ...activity, status: "open" });
  expect((await save()).status).toBe(409);
  mocks.findUnique.mockResolvedValue(activity);
  expect((await save({ ...body, version: "stale" })).status).toBe(409);
  expect(mocks.updateMany).not.toHaveBeenCalled();
});
it("does not change album when a simultaneous edit wins", async () => {
  mocks.updateMany.mockResolvedValue({ count: 0 });
  expect((await save()).status).toBe(409);
  expect(mocks.upsert).not.toHaveBeenCalled();
});
it("rejects missing photos before saving", async () => {
  mocks.headObject.mockResolvedValue(null);
  expect((await save({ ...body, photoKeys: ["activity-recaps/hike/12345678-1234-1234-1234-123456789012.jpg"] })).status).toBe(400);
  expect(mocks.updateMany).not.toHaveBeenCalled();
});
