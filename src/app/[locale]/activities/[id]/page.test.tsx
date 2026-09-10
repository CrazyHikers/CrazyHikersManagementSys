import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), loadLanding: vi.fn() }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/lib/db", () => ({ db: { activity: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/r2", () => ({ getPublicUrl: (key: string) => `https://images.example/${key}` }));
vi.mock("@/lib/events/templates", () => ({ getTemplate: (tag: string) => tag ? { loadLanding: mocks.loadLanding } : undefined }));
vi.mock("@/components/site-header", () => ({ SiteHeader: () => null }));
vi.mock("@/components/site-footer", () => ({ SiteFooter: () => null }));
vi.mock("@/components/share-button", () => ({ ShareButton: () => null }));
vi.mock("@/components/activity-notification-card", () => ({ ActivityNotificationCard: () => null }));
vi.mock("@/components/activity-registration-panel", () => ({
  ActivityRegistrationPanel: (props: unknown) => <div>REGISTRATION_PANEL{JSON.stringify(props)}</div>,
}));

import Page from "./page";

const activity = {
  id: "past-hike", title: "Past hike", description: "Public description", status: "completed",
  date: "2026-05-20T10:00:00Z", deadline: "2026-05-19T10:00:00Z", capacity: 20,
  maximumRegistration: 30, coverImgId: "cover.jpg", _count: { registrations: 12 },
  metadata: { route: "Public route", qrCodeUrl: "PRIVATE_QR", internalNotes: "PRIVATE_NOTE" },
  activityManagers: [{ role: "manager", user: { name: "Guide", email: "PRIVATE_EMAIL", managerProfile: { tag: "Public guide" } } }],
  registrations: [{ userEmail: "PRIVATE_MEMBER", notes: "PRIVATE_REGISTRATION" }],
};

describe("public completed activity", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([null, "matchmaking_520", "audience_520"])("shows public facts without private content for %s", async (template) => {
    mocks.findUnique.mockResolvedValue({ ...activity, metadata: { ...activity.metadata, template } });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: activity.id, locale: "en" }) }));
    for (const text of ["Past hike", "Public description", "Public route", "Public guide", "completed", "cover.jpg"]) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain("PRIVATE_");
    expect(html).not.toContain("REGISTRATION_PANEL");
    expect(mocks.loadLanding).not.toHaveBeenCalled();
    const query = mocks.findUnique.mock.calls[0][0];
    expect(query.include).not.toHaveProperty("registrations");
    expect(query.include.activityManagers.select.user.select).toEqual({ name: true, managerProfile: { select: { tag: true } } });
  });

  it("keeps the registration panel on ordinary open activities", async () => {
    mocks.findUnique.mockResolvedValue({ ...activity, status: "open" });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: activity.id, locale: "en" }) }));
    expect(html).toContain("REGISTRATION_PANEL");
  });
});
