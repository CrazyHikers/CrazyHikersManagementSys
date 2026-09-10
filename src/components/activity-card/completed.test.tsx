import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { DefaultActivityCard } from "./DefaultActivityCard";
import { Matchmaking520Card } from "@/components/events/matchmaking-520/Matchmaking520Card";
import { Audience520Card } from "@/components/events/audience-520/Audience520Card";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

afterEach(cleanup);

const activity = {
  id: "past-hike", title: "Past hike", description: "A mountain walk",
  coverImgUrl: null, date: "2026-05-20T10:00:00Z", deadline: "2026-05-19T10:00:00Z",
  capacity: 20, currentRegistrations: 12, maximumRegistration: 30,
  submissionCount: 0, managerNames: "Guide",
};

describe.each([DefaultActivityCard, Matchmaking520Card, Audience520Card])("completed card %s", (Card) => {
  it("keeps the public detail link and replaces signup controls even for managers", () => {
    render(<Card {...activity} completed managing registered />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/activities/past-hike");
    expect(screen.getByText("completed")).toBeTruthy();
    expect(screen.getByText("viewDetails")).toBeTruthy();
    expect(screen.queryByText("register")).toBeNull();
    expect(screen.queryByText("managing")).toBeNull();
    expect(screen.queryByText("spotsLeft")).toBeNull();
    expect(screen.queryByText("formsSubmitted")).toBeNull();
  });

  it("preserves signup for open activities", () => {
    render(<Card {...activity} />);
    expect(screen.getByText("register")).toBeTruthy();
    expect(screen.getByText("spotsLeft")).toBeTruthy();
  });
});
