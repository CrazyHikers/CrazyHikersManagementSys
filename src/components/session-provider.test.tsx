import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSession } from "next-auth/react";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks }));

import { SessionProvider } from "./session-provider";

const intern = {
  user: { email: "leader@example.com", name: "Leader", role: "manager", isIntern: true },
  expires: "2099-01-01T00:00:00.000Z",
};
let serverSession: typeof intern | null;

function SessionView() {
  const { data, status } = useSession();
  return <output data-testid="session">{JSON.stringify({ data, status })}</output>;
}

async function openPage() {
  await act(async () => {
    render(<SessionProvider><SessionView /></SessionProvider>);
  });
}

async function poll() {
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
}

describe("automatic permission synchronization", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    serverSession = structuredClone(intern);
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => structuredClone(serverSession),
    })));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("updates an open page after qualification without navigation or another login", async () => {
    await openPage();
    expect(screen.getByTestId("session").textContent).toContain('"isIntern":true');
    expect(mocks.refresh).not.toHaveBeenCalled();

    serverSession!.user.isIntern = false;
    await poll();
    expect(screen.getByTestId("session").textContent).toContain('"isIntern":false');
    expect(mocks.refresh).toHaveBeenCalledTimes(1);

    await poll();
    expect(mocks.refresh).toHaveBeenCalledTimes(1);

    serverSession!.user.isIntern = true;
    await poll();
    expect(screen.getByTestId("session").textContent).toContain('"isIntern":true');
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
  });

  it("refreshes server controls when a manager is demoted to a member", async () => {
    await openPage();
    serverSession!.user.role = "member";
    await poll();
    expect(screen.getByTestId("session").textContent).toContain('"role":"member"');
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("checks permissions when returning to an already-open tab", async () => {
    await openPage();
    serverSession!.user.isIntern = false;
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(screen.getByTestId("session").textContent).toContain('"isIntern":false');
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("does not refresh the route for unchanged permissions or name/expiry updates", async () => {
    await openPage();
    serverSession!.user.name = "Updated name";
    serverSession!.expires = "2099-02-01T00:00:00.000Z";
    await poll();
    expect(screen.getByTestId("session").textContent).toContain("Updated name");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("refreshes protected server content when the account's session is invalidated", async () => {
    await openPage();
    serverSession = null;
    await poll();
    expect(screen.getByTestId("session").textContent).toContain('"status":"unauthenticated"');
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
});
