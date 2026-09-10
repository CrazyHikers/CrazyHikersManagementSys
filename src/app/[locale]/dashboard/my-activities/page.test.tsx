import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
const mocks = vi.hoisted(() => ({ registrations: vi.fn(), albums: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: async () => ({ user: { email: "member@example.com" } }) }));
vi.mock("@/lib/db", () => ({ db: { registration: { findMany: mocks.registrations }, activity: { findMany: mocks.albums } } }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("@/lib/r2", () => ({ getPublicUrl: (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({ Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
import Page from "./page";
beforeEach(() => vi.clearAllMocks());

it("keeps historical cards and queries albums only for attended completed activities", async () => {
  mocks.registrations.mockResolvedValue(["attended", "absent", "registration_confirmed"].map((status) => ({
    activityId: status, status, activity: { title: `Hike ${status}`, status: "completed", date: new Date("2026-05-20"), metadata: null, coverImgId: null },
  })));
  mocks.albums.mockResolvedValue([{ id: "attended", recapAlbumUrl: "https://private.example/album" }]);
  const html = renderToStaticMarkup(await Page());
  expect(mocks.registrations.mock.calls[0][0].where.userEmail).toBe("member@example.com");
  expect(mocks.albums.mock.calls[0][0].where.id.in).toEqual(["attended"]);
  expect(html).toContain("Hike attended");
  expect(html).toContain("Hike absent");
  expect(html).toContain('href="/activities/attended"');
  expect(html).toContain('href="https://private.example/album"');
});

it("does not fetch any albums for an absent member", async () => {
  mocks.registrations.mockResolvedValue([{ activityId: "hike", status: "absent", activity: { title: "Hike", status: "completed", date: new Date("2026-05-20"), metadata: null } }]);
  const html = renderToStaticMarkup(await Page());
  expect(mocks.albums).not.toHaveBeenCalled();
  expect(html).not.toContain("viewAlbum");
});
