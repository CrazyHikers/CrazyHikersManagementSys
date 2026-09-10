import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/en/dashboard/activities/hike", useRouter: () => mocks }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
import { ActivityRecapEditor } from "./activity-recap-editor";
const props = { activityId: "hike", version: "2026-09-10T20:00:00Z", publicUrlPrefix: "https://images.example", initialRecap: null };
beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("lets a leader defer the recap and reopen it later without saving", () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  render(<ActivityRecapEditor {...props} initialOpen />);
  fireEvent.click(screen.getByText("later"));
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.queryByLabelText("albumLabel")).toBeNull();
  fireEvent.click(screen.getByText("add"));
  expect(screen.getByLabelText("albumLabel")).toBeTruthy();
});

it("saves optional text and the member album without requiring photos", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", fetch);
  render(<ActivityRecapEditor {...props} initialOpen />);
  fireEvent.change(screen.getByLabelText("albumLabel"), { target: { value: "https://private.example/album" } });
  fireEvent.change(screen.getByLabelText("descriptionLabel"), { target: { value: "Great hike" } });
  fireEvent.click(screen.getByText("save"));
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ version: props.version, description: "Great hike", albumUrl: "https://private.example/album", photoKeys: [] });
});

it("preserves text when saving fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 409 }));
  render(<ActivityRecapEditor {...props} initialOpen />);
  fireEvent.change(screen.getByLabelText("descriptionLabel"), { target: { value: "Keep my text" } });
  fireEvent.click(screen.getByText("save"));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("conflict"));
  expect((screen.getByLabelText("descriptionLabel") as HTMLTextAreaElement).value).toBe("Keep my text");
});
