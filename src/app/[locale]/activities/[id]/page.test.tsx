import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import en from "@/messages/en.json";
import zh from "@/messages/zh.json";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), loadLanding: vi.fn() }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("next-intl/server", () => ({ getTranslations: async (options: string | { locale?: string }) => (key: string, values?: { title?: string }) => {
  const messages = typeof options === "object" && options.locale === "zh" ? zh.common : en.common;
  return ((messages as Record<string, string>)[key] ?? key).replace("{title}", values?.title ?? "");
} }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/lib/db", () => ({ db: { activity: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/r2", () => ({ getPublicUrl: (key: string) => `https://images.example/${key}` }));
vi.mock("@/lib/events/templates", () => ({ getTemplate: (tag: string) => tag ? { loadLanding: mocks.loadLanding } : undefined }));
vi.mock("@/components/site-header", () => ({ SiteHeader: () => null }));
vi.mock("@/components/site-footer", () => ({ SiteFooter: () => null }));
vi.mock("@/components/share-button", () => ({ ShareButton: (props: unknown) => <div data-testid="share">{JSON.stringify(props)}</div> }));
vi.mock("@/components/activity-recap", () => ({ ActivityRecapSection: (props: unknown) => <div>{JSON.stringify(props)}</div> }));
vi.mock("@/components/attendee-album-link", () => ({ AttendeeAlbumLink: (props: unknown) => <div>{JSON.stringify(props)}</div> }));
vi.mock("@/components/activity-notification-card", () => ({ ActivityNotificationCard: () => null }));
vi.mock("@/components/activity-registration-panel", () => ({
  ActivityRegistrationPanel: (props: unknown) => <div>REGISTRATION_PANEL{JSON.stringify(props)}</div>,
}));

import Page, { generateMetadata } from "./page";

const activity = {
  id: "past-hike", title: "Past hike", description: "Public description", status: "completed",
  date: "2026-05-20T10:00:00Z", deadline: "2026-05-19T10:00:00Z", capacity: 20,
  maximumRegistration: 30, coverImgId: "cover.jpg", _count: { registrations: 12 },
  metadata: { route: "Public route", qrCodeUrl: "PRIVATE_QR", internalNotes: "PRIVATE_NOTE" },
  activityManagers: [{ role: "manager", user: { name: "Guide", email: "PRIVATE_EMAIL", managerProfile: { tag: "Public guide" } } }],
  recapDescription: "Public recap", recapPhotoKeys: [], recapAlbumUrl: "PRIVATE_ALBUM",
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

  it("shows a Swiss summer deadline of 17:00 as 17:00 on a UTC server (#36)", async () => {
    mocks.findUnique.mockResolvedValue({ ...activity, deadline: "2026-09-02T15:00:00.000Z" });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: activity.id, locale: "zh" }) }));
    expect(html).toContain("17:00");
  });

  it("shares completed activities through their own public URL even with a reused slug", async () => {
    mocks.findUnique.mockResolvedValue({ ...activity, metadata: { ...activity.metadata, slug: "shared-slug" } });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: activity.id, locale: "zh" }) }));
    expect(html).toContain('data-testid="share"');
    expect(html).toContain("/zh/activities/past-hike");
    expect(html).toContain("activityKind&quot;:&quot;recap");
    expect(html).not.toContain("/events/shared-slug");
    expect(html).not.toContain("PRIVATE_ALBUM");
  });

  it.each([
    ["zh", "completed", "活动回顾 | Past hike"],
    ["zh", "open", "活动报名 | Past hike"],
    ["en", "completed", "Activity Recap | Past hike"],
    ["en", "open", "Activity Registration | Past hike"],
  ])("uses the %s/%s title for link previews", async (locale, status, expected) => {
    mocks.findUnique.mockResolvedValue({ ...activity, status });
    const metadata = await generateMetadata({ params: Promise.resolve({ id: activity.id, locale }) });
    expect(metadata.title).toBe(expected);
    expect(metadata.openGraph?.title).toBe(expected);
    expect(metadata.twitter?.title).toBe(expected);
    expect(metadata.description).toBe(status === "completed" ? "Public recap" : "Public description");
    expect(JSON.stringify(metadata)).not.toContain("PRIVATE_");
  });
});
