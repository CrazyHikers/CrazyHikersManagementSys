import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({ open: vi.fn(), completed: vi.fn() }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("@/lib/activity", () => ({ getRegisterableOpenActivities: mocks.open, getCompletedActivities: mocks.completed }));
vi.mock("@/lib/r2", () => ({ getPublicUrl: (key: string) => `https://images.example/${key}` }));
vi.mock("@/components/site-header", () => ({ SiteHeader: () => null }));
vi.mock("@/components/site-footer", () => ({ SiteFooter: () => null }));
vi.mock("@/components/activity-list", () => ({ ActivityList: () => <div>OPEN_ACTIVITIES</div> }));
vi.mock("@/components/activity-card", () => ({ ActivityCard: (props: unknown) => <div>{JSON.stringify(props)}</div> }));

import HomePage from "./page";

beforeEach(() => { vi.clearAllMocks(); mocks.open.mockResolvedValue([]); });

it("shows completed activities even when signup is empty, passing only public card fields", async () => {
  mocks.completed.mockResolvedValue([{
    id: "past-hike", title: "Past hike", description: "Public description",
    date: "2026-05-20T10:00:00Z", deadline: "2026-05-19T10:00:00Z",
    coverImgId: "cover.jpg", homepageThumbnailImgId: "thumbnail.jpg", capacity: 20,
    maximumRegistration: 30, _count: { registrations: 12 },
    metadata: { template: "audience_520", qrCodeUrl: "PRIVATE_QR" },
    activityManagers: [{ user: { name: "Guide", email: "PRIVATE_EMAIL", managerProfile: { tag: "Public guide" } } }],
  }]);
  const html = renderToStaticMarkup(await HomePage());
  expect(html).toContain("noActivities");
  expect(html).toContain('aria-labelledby="past-activities-title"');
  expect(html).toContain("Past hike");
  expect(html).toContain("thumbnail.jpg");
  expect(html).toContain("audience_520");
  expect(html).toContain("completed&quot;:true");
  expect(html).not.toContain("PRIVATE_");
});

it("omits an empty archive section", async () => {
  mocks.completed.mockResolvedValue([]);
  const html = renderToStaticMarkup(await HomePage());
  expect(html).not.toContain("past-activities-title");
});
