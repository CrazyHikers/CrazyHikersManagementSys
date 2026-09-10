import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import zh from "@/messages/zh.json";
import { ShareButton } from "./share-button";

afterEach(() => { cleanup(); Reflect.deleteProperty(navigator, "share"); });

it.each([
  ["zh", "recap", "活动回顾 | 山间徒步"],
  ["zh", "registration", "活动报名 | 山间徒步"],
  ["en", "recap", "Activity Recap | 山间徒步"],
  ["en", "registration", "Activity Registration | 山间徒步"],
] as const)("shares a %s/%s title through the native share menu", async (locale, activityKind, title) => {
  const share = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "share", { configurable: true, value: share });
  const messages = locale === "zh" ? zh : en;
  render(<NextIntlClientProvider locale={locale} messages={messages}>
    <ShareButton path={`/${locale}/activities/hike`} title="山间徒步" activityKind={activityKind} />
  </NextIntlClientProvider>);
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(share).toHaveBeenCalled());
  expect(share.mock.calls[0][0]).toEqual({
    title, url: `${window.location.origin}/${locale}/activities/hike`,
    text: `${title}\n${activityKind === "recap" ? messages.common.recapShareText : messages.common.shareText}`,
  });
});
