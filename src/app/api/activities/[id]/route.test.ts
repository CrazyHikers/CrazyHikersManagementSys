import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activityFindUnique: vi.fn(),
  activityUpdate: vi.fn(),
  registrationCount: vi.fn(),
  registrationFindMany: vi.fn(),
  registrationUpdateMany: vi.fn(),
  registrationDeleteMany: vi.fn(),
  activityManagerUpdateMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({
    user: { email: "manager@example.com", role: "manager" },
  })),
}));
vi.mock("@/lib/permissions", () => ({ can: vi.fn(() => true) }));
vi.mock("@/lib/db", () => ({
  db: {
    activity: {
      findUnique: mocks.activityFindUnique,
      update: mocks.activityUpdate,
    },
    registration: {
      count: mocks.registrationCount,
      findMany: mocks.registrationFindMany,
      updateMany: mocks.registrationUpdateMany,
      deleteMany: mocks.registrationDeleteMany,
    },
    activityManager: { updateMany: mocks.activityManagerUpdateMany },
    userFlag: { count: vi.fn(), create: vi.fn() },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/settings", () => ({ getSetting: vi.fn() }));
vi.mock("@/lib/flags", () => ({
  getFlagSettings: vi.fn(),
  unexpiredCutoff: vi.fn(),
}));
vi.mock("@/lib/r2", () => ({
  deleteFile: vi.fn(),
  getKeyFromUrl: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

import { PATCH } from "./route";

describe("completing an activity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activityFindUnique.mockResolvedValue({ metadata: null });
    mocks.registrationCount.mockResolvedValue(1);
    mocks.registrationFindMany.mockResolvedValue([]);
    mocks.registrationUpdateMany.mockReturnValue(Promise.resolve({ count: 1 }));
    mocks.registrationDeleteMany.mockReturnValue(Promise.resolve({ count: 0 }));
    mocks.activityManagerUpdateMany.mockReturnValue(Promise.resolve({ count: 0 }));
    mocks.activityUpdate.mockReturnValue(Promise.resolve({ id: "activity-1" }));
    mocks.transaction.mockResolvedValue([]);
  });

  it("defaults every still-confirmed registration to attended", async () => {
    const request = new Request("http://localhost/api/activities/activity-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });

    const response = await PATCH(request as never, {
      params: Promise.resolve({ id: "activity-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.registrationUpdateMany).toHaveBeenCalledWith({
      where: {
        activityId: "activity-1",
        status: "registration_confirmed",
      },
      data: { status: "attended" },
    });
    expect(mocks.registrationDeleteMany).toHaveBeenCalledWith({
      where: { activityId: "activity-1", status: "registered" },
    });
  });
});
