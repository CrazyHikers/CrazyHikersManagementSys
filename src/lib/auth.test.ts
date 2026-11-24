import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JWT } from "next-auth/jwt";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("./db", () => ({ db: { user: { findUnique: mocks.findUnique } } }));
vi.mock("./turnstile", () => ({ verifyTurnstileStatus: vi.fn() }));
vi.mock("next-auth", () => ({
  default: vi.fn(() => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() })),
  CredentialsSignin: class extends Error {},
}));

import { authConfig } from "./auth";
import { canApproveRegistrations, canProposeRegistration } from "./permissions";

const jwt = authConfig.callbacks!.jwt!;
const session = authConfig.callbacks!.session!;
const email = "leader@example.com";

// Auth.js omits `user` on session reads, despite its public callback type
// requiring it (its session action uses @ts-expect-error for the same call).
function refreshToken(args: Omit<Parameters<typeof jwt>[0], "user"> & {
  user?: Parameters<typeof jwt>[0]["user"];
}) {
  return jwt(args as Parameters<typeof jwt>[0]);
}

function profile(intern: boolean) {
  return { email, name: "Leader", role: "manager", passwordHash: null, managerProfile: { tag: "Leader", intern } };
}

// Ordinary authenticated requests have no user or update trigger. Reuse the
// original cookie claims, as happens when an admin changes another user's role.
async function readSession(token: JWT) {
  const refreshed = await refreshToken({ token });
  if (!refreshed) return null;
  return session({
    session: { user: { email }, expires: "2099-01-01T00:00:00.000Z" },
    token: refreshed,
  } as Parameters<typeof session>[0]);
}

describe("live session permissions", () => {
  beforeEach(() => {
    mocks.findUnique.mockReset();
  });

  it("allows approval after an intern is qualified without signing in again", async () => {
    const cookie = { email, role: "manager", isIntern: true };
    mocks.findUnique.mockResolvedValue(profile(true));
    expect(canProposeRegistration(await readSession({ ...cookie }))).toBe(true);

    mocks.findUnique.mockResolvedValue(profile(false));
    const promoted = await readSession({ ...cookie });
    expect(canApproveRegistrations(promoted)).toBe(true);
    expect(canProposeRegistration(promoted)).toBe(false);
  });

  it("revokes approval when a qualified manager becomes an intern", async () => {
    mocks.findUnique.mockResolvedValue(profile(true));
    const demoted = await readSession({ email, role: "manager", isIntern: false });
    expect(canApproveRegistrations(demoted)).toBe(false);
    expect(canProposeRegistration(demoted)).toBe(true);
  });

  it("revokes manager permissions and clears profile claims on demotion to member", async () => {
    mocks.findUnique.mockResolvedValue({ ...profile(false), role: "member", managerProfile: null });
    const demoted = await readSession({ email, role: "manager", isIntern: false, tag: "Old tag" });
    expect(demoted?.user).toMatchObject({ role: "member", isIntern: false });
    expect(demoted?.user).toHaveProperty("tag", undefined);
    expect(canApproveRegistrations(demoted)).toBe(false);
    expect(canProposeRegistration(demoted)).toBe(false);
  });

  it("grants manager permissions to an existing member session", async () => {
    mocks.findUnique.mockResolvedValue(profile(false));
    expect(canApproveRegistrations(await readSession({ email, role: "member" }))).toBe(true);
  });

  it("does not retain an admin's privileges after demotion", async () => {
    mocks.findUnique.mockResolvedValue({ ...profile(false), role: "member", managerProfile: null });
    expect(canApproveRegistrations(await readSession({ email, role: "admin" }))).toBe(false);
  });

  it("never treats a manager with a missing profile as qualified", async () => {
    mocks.findUnique.mockResolvedValue({ ...profile(false), managerProfile: null });
    expect(canApproveRegistrations(await readSession({ email, role: "manager", isIntern: false }))).toBe(false);
  });

  it("invalidates sessions belonging to deleted users", async () => {
    mocks.findUnique.mockResolvedValue(null);
    expect(await readSession({ email, role: "admin" })).toBeNull();
  });

  it("does not reuse privileged claims if the database cannot verify them", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.findUnique.mockRejectedValue(new Error("Database unavailable"));
    expect(await readSession({ email, role: "admin" })).toBeNull();
  });

  it("cannot create an authenticated session from a token without an identity", async () => {
    expect(await refreshToken({ token: { role: "admin" } })).toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("ignores client-supplied roles on a session update", async () => {
    mocks.findUnique.mockResolvedValue(profile(true));
    const token = await refreshToken({
      token: { email, role: "manager", isIntern: true }, trigger: "update",
      session: { user: { role: "admin", isIntern: false } },
    });
    expect(token).toMatchObject({ role: "manager", isIntern: true });
  });

  it("refreshes claims on sign-in and supports legacy subject-only tokens", async () => {
    mocks.findUnique.mockResolvedValue({ ...profile(false), name: "New name" });
    const signedIn = await refreshToken({ token: {}, user: { email } });
    expect(signedIn).toMatchObject({ email, name: "New name", role: "manager", isIntern: false });
    expect(canApproveRegistrations(await readSession({ sub: email, role: "member" }))).toBe(true);
  });
});
