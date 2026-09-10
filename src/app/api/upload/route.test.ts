import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), findUnique: vi.fn(), uploadFile: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: { activity: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/r2", () => ({ uploadFile: mocks.uploadFile }));
vi.mock("@/lib/settings", () => ({ getSetting: async () => 5 }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ allowed: true }) }));
import { POST } from "./route";
const id = "12345678-1234-1234-1234-123456789012";
const manager = { userEmail: "guide@example.com", status: "confirmed", role: "manager" };
function upload(folder = `activity-recaps/${id}`, type = "image/jpeg") {
  return POST({ formData: async () => new Map<string, unknown>([
    ["folder", folder], ["file", { type, size: 3, arrayBuffer: async () => new ArrayBuffer(3) }],
  ]) } as never);
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { email: "guide@example.com", role: "manager" } });
  mocks.findUnique.mockResolvedValue({ status: "completed", activityManagers: [manager] });
  mocks.uploadFile.mockResolvedValue("https://images.example/photo.jpg");
});

it("uploads recap photos for a confirmed leader", async () => {
  expect((await upload()).status).toBe(200);
  expect(mocks.uploadFile.mock.calls[0][0]).toMatch(new RegExp(`^activity-recaps/${id}/[a-f0-9-]+\\.jpg$`));
});
it("rejects another manager or an unconfirmed invitation", async () => {
  mocks.auth.mockResolvedValue({ user: { email: "other@example.com", role: "manager" } });
  expect((await upload()).status).toBe(403);
  mocks.auth.mockResolvedValue({ user: { email: manager.userEmail, role: "manager" } });
  mocks.findUnique.mockResolvedValue({ status: "completed", activityManagers: [{ ...manager, status: "invited" }] });
  expect((await upload()).status).toBe(403);
  expect(mocks.uploadFile).not.toHaveBeenCalled();
});
it("rejects unfinished activities and unsupported files", async () => {
  expect((await upload(`activity-recaps/${id}`, "text/html")).status).toBe(415);
  mocks.findUnique.mockResolvedValue({ status: "open", activityManagers: [manager] });
  expect((await upload()).status).toBe(409);
  expect(mocks.uploadFile).not.toHaveBeenCalled();
});
it("preserves existing non-recap uploads", async () => {
  expect((await upload("covers")).status).toBe(200);
  expect(mocks.findUnique).not.toHaveBeenCalled();
});
