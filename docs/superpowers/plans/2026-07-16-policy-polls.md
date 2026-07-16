# Member Polling System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an authenticated, role-scoped, application-anonymous polling system with admin authoring, deadline closure, post-close results, optional free-text feedback, and one-shot non-email notifications.

**Architecture:** Add dedicated Prisma poll tables, keep identity-bearing participation rows separate from identity-free ballot rows, and centralize scope/status/validation rules in `src/lib/polls`. Server Components read minimal DTOs; small Client Components call thin App Router Route Handlers for mutations. Publishing schedules a best-effort `poll_published` dispatch with Next.js 16 `after()`.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript, Prisma 7/PostgreSQL, Auth.js, next-intl, shadcn/Base UI, Vitest, React Testing Library.

**Local Next.js guides consulted:** `01-app/01-getting-started/05-server-and-client-components.md`, `15-route-handlers.md`, `02-guides/data-security.md`, `02-guides/testing/vitest.md`, `03-api-reference/03-file-conventions/dynamic-routes.md`, and `03-api-reference/04-functions/after.md`.

---

## File map

- `prisma/schema.prisma`, `prisma/migrations/20260716140000_add_polls/migration.sql`: poll enums, models, relations, indexes, and ballot XOR check.
- `src/lib/polls/rules.ts`: dependency-free scope, status, input validation, and result aggregation.
- `src/lib/polls/service.ts`: server-only Prisma reads and mutations; returns minimal DTOs and never joins participation to ballots.
- `src/lib/polls/notifications.ts`: scope-filtered one-shot notification fan-out.
- `src/lib/polls/types.ts`: serialized DTO contracts shared with Client Components.
- `src/app/api/polls/**/route.ts`: authenticated thin HTTP adapters.
- `src/app/[locale]/dashboard/polls/**/page.tsx`: Server Component list, detail, create, and manage pages.
- `src/components/dashboard/polls/*.tsx`: focused interactive vote/admin controls and static result presentation.
- `src/lib/permissions.ts`, `src/components/dashboard/nav.tsx`: centralized permissions and separate member/admin navigation entries.
- `src/lib/notify/{types,messages,index}.ts`, `src/components/notification-settings.tsx`: `poll_published` preference and message.
- `src/messages/{zh,en}.json`: all user-facing poll and notification copy.
- `vitest.config.mts`, `src/**/*.test.ts(x)`: unit and component coverage; existing untracked `tests/` and `playwright.config.ts` remain untouched.

### Task 1: Establish the test harness

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.config.mts`

- [ ] **Step 1: Install the official Next.js Vitest stack**

Run:

```powershell
npm install --save-dev vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths
```

Expected: dependencies are added without changing runtime dependencies.

- [ ] **Step 2: Add deterministic test scripts**

Add to `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Create `vitest.config.mts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    restoreMocks: true,
  },
});
```

- [ ] **Step 3: Verify the harness has no tests yet**

Run: `npm test -- --passWithNoTests`

Expected: exit 0 and no test files found; the untracked Playwright example is not collected.

- [ ] **Step 4: Commit the harness**

```powershell
git add package.json package-lock.json vitest.config.mts
git commit -m test-add-vitest-harness
```

### Task 2: Define and test poll domain rules

**Files:**
- Create: `src/lib/polls/rules.test.ts`
- Create: `src/lib/polls/rules.ts`
- Create: `src/lib/polls/types.ts`

- [ ] **Step 1: Write failing scope and status tests**

Create `src/lib/polls/rules.test.ts` with table-driven assertions:

```ts
import { describe, expect, it } from "vitest";
import {
  aggregatePollResults,
  canRoleAccessScope,
  effectivePollStatus,
  validateBallotInput,
  validatePollInput,
} from "./rules";

describe("canRoleAccessScope", () => {
  it.each([
    ["member", "member_plus", true],
    ["member", "manager_plus", false],
    ["manager", "manager_plus", true],
    ["manager", "admin", false],
    ["admin", "admin", true],
    ["dev", "admin", true],
  ] as const)("maps %s to %s", (role, scope, expected) => {
    expect(canRoleAccessScope(role, scope)).toBe(expected);
  });
});

describe("effectivePollStatus", () => {
  const now = new Date("2026-07-16T12:00:00Z");
  it("closes an open poll at its deadline", () => {
    expect(effectivePollStatus("open", new Date("2026-07-16T12:00:00Z"), now)).toBe("closed");
  });
  it("does not reopen explicit closed or draft polls", () => {
    expect(effectivePollStatus("closed", new Date("2026-07-20T12:00:00Z"), now)).toBe("closed");
    expect(effectivePollStatus("draft", new Date("2026-07-20T12:00:00Z"), now)).toBe("draft");
  });
});

describe("poll input validation", () => {
  it("normalizes a valid custom poll", () => {
    expect(validatePollInput({
      title: " Policy ", description: " Details ", scope: "member_plus",
      deadline: "2026-07-20T12:00:00.000Z", allowOther: true,
      options: [" Yes ", "No"],
    })).toMatchObject({ title: "Policy", description: "Details", options: ["Yes", "No"] });
  });
  it.each([
    [{ title: "", description: "", scope: "member_plus", deadline: "2026-07-20T12:00:00.000Z", allowOther: false, options: ["A", "B"] }, "title"],
    [{ title: "X", description: "", scope: "member_plus", deadline: "bad", allowOther: false, options: ["A", "B"] }, "deadline"],
    [{ title: "X", description: "", scope: "member_plus", deadline: "2026-07-20T12:00:00.000Z", allowOther: false, options: ["Same", "same"] }, "options"],
  ])("rejects invalid data", (input, field) => {
    expect(() => validatePollInput(input)).toThrowError(new RegExp(field));
  });
});

describe("ballots and aggregation", () => {
  const poll = { id: "p1", allowOther: true, optionIds: ["a", "b"] };
  it("accepts exactly one owned option or one other text", () => {
    expect(validateBallotInput({ optionId: "a" }, poll)).toEqual({ optionId: "a", otherText: null });
    expect(validateBallotInput({ otherText: " New idea " }, poll)).toEqual({ optionId: null, otherText: "New idea" });
    expect(() => validateBallotInput({ optionId: "a", otherText: "x" }, poll)).toThrow();
    expect(() => validateBallotInput({ optionId: "foreign" }, poll)).toThrow();
  });
  it("counts all ballots and preserves each other response", () => {
    expect(aggregatePollResults(
      [{ id: "a", label: "A", sortOrder: 0 }, { id: "b", label: "B", sortOrder: 1 }],
      [{ optionId: "a", otherText: null }, { optionId: "a", otherText: null }, { optionId: null, otherText: "Idea" }],
    )).toEqual({
      total: 3,
      options: [
        { id: "a", label: "A", count: 2, percentage: 66.7 },
        { id: "b", label: "B", count: 0, percentage: 0 },
      ],
      other: { count: 1, percentage: 33.3, texts: ["Idea"] },
    });
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/lib/polls/rules.test.ts`

Expected: FAIL because `./rules` does not exist.

- [ ] **Step 3: Implement the minimal pure domain API**

Create `src/lib/polls/types.ts` with explicit string unions and serialized DTOs. Create `rules.ts` exporting the five tested functions, a `PollValidationError` with a `field` property, limits `{ title: 120, description: 4000, option: 200, other: 500 }`, case-insensitive option deduplication, and one-decimal percentages. Keep this file dependency-free so both server code and tests can import it.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `npm test -- src/lib/polls/rules.test.ts`

Expected: all domain tests pass.

- [ ] **Step 5: Commit domain rules**

```powershell
git add src/lib/polls/rules.ts src/lib/polls/rules.test.ts src/lib/polls/types.ts
git commit -m feat-add-poll-domain-rules
```

### Task 3: Add the dedicated Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260716140000_add_polls/migration.sql`

- [ ] **Step 1: Add schema relations and models**

Add `PollScope`, `PollStatus`, `Poll`, `PollOption`, `PollParticipation`, and `PollBallot` exactly as specified in the design. Add `createdPolls Poll[] @relation("PollCreator")` to `User`; add `poll` to `AuditEntityType`. Use cascade deletes only from a draft poll to child rows and `Restrict` from ballots to options.

- [ ] **Step 2: Add the SQL migration including the anonymity invariant**

Create the enum/table/index SQL matching Prisma and add:

```sql
ALTER TABLE "poll_ballots" ADD CONSTRAINT "poll_ballot_choice_xor"
CHECK (("option_id" IS NOT NULL AND "other_text" IS NULL)
    OR ("option_id" IS NULL AND "other_text" IS NOT NULL));
```

- [ ] **Step 3: Validate and generate the Prisma client**

Run: `npx prisma validate`

Expected: schema valid.

Run: `npx prisma generate`

Expected: generated client contains poll models and enums.

- [ ] **Step 4: Re-run domain tests**

Run: `npm test -- src/lib/polls/rules.test.ts`

Expected: pass.

- [ ] **Step 5: Commit schema**

```powershell
git add prisma/schema.prisma prisma/migrations/20260716140000_add_polls/migration.sql src/generated/prisma
git commit -m feat-add-poll-schema
```

### Task 4: Implement the server-only poll service and lifecycle APIs

**Files:**
- Create: `src/lib/polls/service.test.ts`
- Create: `src/lib/polls/service.ts`
- Modify: `src/lib/permissions.ts`
- Create: `src/app/api/polls/route.ts`
- Create: `src/app/api/polls/[id]/route.ts`
- Create: `src/app/api/polls/[id]/publish/route.ts`
- Create: `src/app/api/polls/[id]/close/route.ts`

- [ ] **Step 1: Write failing service tests with a transaction fake**

Test that `createPoll`, `publishPoll`, `updatePoll`, and `closePoll`:

```ts
it("creates ordered options and a create audit row", async () => {
  const db = makePollDbFake();
  const poll = await createPoll(db, adminActor, validInput, now);
  expect(poll.options.map((o) => o.sortOrder)).toEqual([0, 1]);
  expect(db.auditRows).toContainEqual(expect.objectContaining({ entityType: "poll", action: "create" }));
});

it("locks content after publish but permits a strict deadline extension", async () => {
  const db = makePollDbFake({ poll: openPoll });
  await expect(updatePoll(db, adminActor, "p1", { title: "changed" }, now)).rejects.toMatchObject({ code: "POLL_LOCKED" });
  await expect(updatePoll(db, adminActor, "p1", { deadline: "2026-07-21T12:00:00.000Z" }, now)).resolves.toMatchObject({ deadline: new Date("2026-07-21T12:00:00.000Z") });
});
```

The fake implements only the repository interface declared in `service.ts`; it must also assert draft-only publish, no reopen, future deadlines, and audit writes.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/lib/polls/service.test.ts`

Expected: FAIL because the service API is missing.

- [ ] **Step 3: Implement the service and permissions**

Add `polls.read`, `polls.vote`, and `polls.manage` to `Permission` and the matrix. In `service.ts`, add `import "server-only"`, use a narrow `PollRepository` interface for tested lifecycle logic, and expose a Prisma-backed adapter for route handlers. Return DTOs rather than raw Prisma rows.

- [ ] **Step 4: Add thin authenticated lifecycle Route Handlers**

Each handler must parse JSON safely, re-authorize with `auth()`/`can()`, await dynamic `params`, map `PollError.code` to `400/403/404/409`, and never return raw errors. `GET` handlers rely on request-time auth/database access and require no cache override in Next.js 16.

- [ ] **Step 5: Run service and domain tests**

Run: `npm test -- src/lib/polls/rules.test.ts src/lib/polls/service.test.ts`

Expected: pass.

- [ ] **Step 6: Commit lifecycle backend**

```powershell
git add src/lib/polls/service.ts src/lib/polls/service.test.ts src/lib/permissions.ts src/app/api/polls
git commit -m feat-add-poll-lifecycle-api
```

### Task 5: Implement anonymous voting, participants, and closed results

**Files:**
- Modify: `src/lib/polls/service.test.ts`
- Modify: `src/lib/polls/service.ts`
- Create: `src/app/api/polls/[id]/vote/route.ts`
- Create: `src/app/api/polls/[id]/participants/route.ts`

- [ ] **Step 1: Write failing anonymity and conflict tests**

Add tests that assert:

```ts
it("writes identity and ballot to separate tables in one transaction", async () => {
  const db = makePollDbFake({ poll: openMemberPoll });
  await submitBallot(db, memberActor, "p1", { optionId: "o1" }, now);
  expect(db.participations).toEqual([{ pollId: "p1", voterEmail: memberActor.email, votedAt: now }]);
  expect(db.ballots).toEqual([{ pollId: "p1", optionId: "o1", otherText: null }]);
  expect(db.ballots[0]).not.toHaveProperty("voterEmail");
  expect(db.ballots[0]).not.toHaveProperty("votedAt");
});

it.each(["duplicate", "out_of_scope", "closed", "expired"])("rejects %s submissions", async (scenario) => {
  await expect(runScenario(scenario)).rejects.toMatchObject({ code: expect.any(String) });
});

it("never returns tallies while open and returns them after close", async () => {
  expect(await getPollDetail(openDb, memberActor, "p1", now)).not.toHaveProperty("results");
  expect(await getPollDetail(closedDb, memberActor, "p1", now)).toHaveProperty("results.total", 3);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/lib/polls/service.test.ts`

Expected: new tests fail because voting/result methods are missing.

- [ ] **Step 3: Implement the transactional vote and minimized reads**

Implement `submitBallot`, `getPollDetail`, `listPolls`, and `listParticipants`. Catch Prisma `P2002` for `(pollId, voterEmail)` and map it to `ALREADY_VOTED`. Do not include ballots in participant queries; do not include tallies in any open-poll DTO, even for admins.

- [ ] **Step 4: Add vote and participant handlers**

`POST /vote` returns `{ ok: true }` only. `GET /participants` requires `polls.manage` and returns `{ participants: [{ email, name, votedAt }] }` without ballot fields.

- [ ] **Step 5: Run all backend tests**

Run: `npm test -- src/lib/polls`

Expected: pass, including anonymous separation and deadline rejection.

- [ ] **Step 6: Commit voting backend**

```powershell
git add src/lib/polls/service.ts src/lib/polls/service.test.ts src/app/api/polls/[id]/vote src/app/api/polls/[id]/participants
git commit -m feat-add-anonymous-poll-voting
```

### Task 6: Add one-shot scoped notifications

**Files:**
- Modify: `src/lib/notify/types.ts`
- Modify: `src/lib/notify/messages.ts`
- Modify: `src/lib/notify/index.ts`
- Create: `src/lib/polls/notifications.test.ts`
- Create: `src/lib/polls/notifications.ts`
- Modify: `src/app/api/polls/[id]/publish/route.ts`
- Modify: `src/components/notification-settings.tsx`
- Modify: `src/messages/zh.json`
- Modify: `src/messages/en.json`

- [ ] **Step 1: Write failing recipient/filter tests**

Test `rolesForPollScope` and `notifyPollAudience` with injected `findUsers`/`send` functions. Assert manager polls exclude members, admin polls include admin/dev only, every selected user is sent exactly once, and a rejected send is logged but not retried.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/lib/polls/notifications.test.ts`

Expected: FAIL because notification helpers do not exist.

- [ ] **Step 3: Implement notification kind and audience helper**

Add `poll_published` to `NotificationKind`, `MEMBER_KINDS`, `DEFAULT_PREFS`, the settings UI `Prefs` type/list, dispatch builder, and index exports. `notifyPollAudience` queries role-matching users and calls existing `notify()` once per user; existing channels attempt only configured subscriptions and existing non-production mute behavior remains intact.

- [ ] **Step 4: Schedule the send after a successful publish response**

In the publish Route Handler:

```ts
import { after } from "next/server";

const poll = await publishPoll(...);
after(async () => {
  await notifyPollAudience(poll).catch((error) => {
    console.error("[polls] publish notification failed", error);
  });
});
return NextResponse.json({ ok: true, poll });
```

Do not add a queue, retry, or email call.

- [ ] **Step 5: Run notification and backend tests**

Run: `npm test -- src/lib/polls`

Expected: pass.

- [ ] **Step 6: Commit notifications**

```powershell
git add src/lib/notify src/lib/polls/notifications.ts src/lib/polls/notifications.test.ts src/app/api/polls/[id]/publish/route.ts src/components/notification-settings.tsx src/messages/zh.json src/messages/en.json
git commit -m feat-notify-scoped-poll-audience
```

### Task 7: Build the member poll list, vote, and results UI

**Files:**
- Create: `src/components/dashboard/polls/poll-vote-form.test.tsx`
- Create: `src/components/dashboard/polls/poll-vote-form.tsx`
- Create: `src/components/dashboard/polls/poll-results.tsx`
- Create: `src/components/dashboard/polls/poll-status-badge.tsx`
- Create: `src/app/[locale]/dashboard/polls/page.tsx`
- Create: `src/app/[locale]/dashboard/polls/[id]/page.tsx`
- Modify: `src/components/dashboard/nav.tsx`
- Modify: `src/messages/zh.json`
- Modify: `src/messages/en.json`

- [ ] **Step 1: Write a failing vote form component test**

Render two radio options plus “other”; assert the submit button remains disabled until a choice is made, other text is required when selected, a confirmation dialog appears, the API receives exactly `{ optionId }` or `{ otherText }`, and success replaces the form.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/components/dashboard/polls/poll-vote-form.test.tsx`

Expected: FAIL because the component is missing.

- [ ] **Step 3: Implement focused interactive and static components**

Keep the page as an async Server Component and pass only the serialized poll DTO to the small Client vote form. Use existing Card, Button, Badge, radio inputs, Textarea, and Dialog primitives. Result bars render count plus percentage and list each other response as plain React text.

- [ ] **Step 4: Implement list/detail pages and member nav entry**

Authenticate in each page, call the server-only poll service directly, await `params`, and redirect scope failures to `/dashboard/polls`. Put `{ key: "polls", href: "/dashboard/polls" }` in `memberItems` so every role sees it.

- [ ] **Step 5: Add complete zh/en copy and run tests**

Run: `npm test -- src/components/dashboard/polls src/lib/polls`

Expected: pass.

- [ ] **Step 6: Commit member UI**

```powershell
git add src/components/dashboard/polls src/app/[locale]/dashboard/polls src/components/dashboard/nav.tsx src/messages/zh.json src/messages/en.json
git commit -m feat-add-member-poll-ui
```

### Task 8: Build the separate admin creation and management UI

**Files:**
- Create: `src/components/dashboard/polls/poll-editor.test.tsx`
- Create: `src/components/dashboard/polls/poll-editor.tsx`
- Create: `src/components/dashboard/polls/poll-admin-actions.tsx`
- Create: `src/app/[locale]/dashboard/polls/new/page.tsx`
- Create: `src/app/[locale]/dashboard/polls/[id]/manage/page.tsx`
- Modify: `src/components/dashboard/nav.tsx`
- Modify: `src/messages/zh.json`
- Modify: `src/messages/en.json`

- [ ] **Step 1: Write failing editor tests**

Assert two options minimum, ten maximum, duplicate validation, “赞成 / 反对” template fill, allow-other toggle, draft save payload, publish confirmation, and that an open poll renders only deadline extension/close controls.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/components/dashboard/polls/poll-editor.test.tsx`

Expected: FAIL because admin components are missing.

- [ ] **Step 3: Implement editor and lifecycle controls**

Use one editor component for create and draft edit. Use a separate admin actions component for publish, strict deadline extension, and early close. After successful mutations call `router.push`/`router.refresh`; surface mapped errors with Sonner.

- [ ] **Step 4: Add protected admin pages and separate nav entry**

Both pages must call `auth()` and `can(session, "polls.manage")` before any data read. Add `{ key: "createPoll", href: "/dashboard/polls/new" }` only to `adminItems`; do not place creation in `memberItems`.

- [ ] **Step 5: Run UI and backend tests**

Run: `npm test`

Expected: all Vitest files pass.

- [ ] **Step 6: Commit admin UI**

```powershell
git add src/components/dashboard/polls src/app/[locale]/dashboard/polls src/components/dashboard/nav.tsx src/messages/zh.json src/messages/en.json
git commit -m feat-add-admin-poll-ui
```

### Task 9: Verify security boundaries and production readiness

**Files:**
- Modify only if verification exposes a defect in files already listed.

- [ ] **Step 1: Refresh the structural index for edited code**

Run: `graphify auto-update .`

Expected: poll files are indexed; if the Windows graphify launcher remains unavailable, record that limitation and continue with source-level verification.

- [ ] **Step 2: Run the complete test suite**

Run: `npm test`

Expected: zero failed tests.

- [ ] **Step 3: Run lint and TypeScript**

Run: `npm run lint`

Expected: exit 0 with no new warnings.

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 4: Validate Prisma and generate a fresh client**

Run: `npx prisma validate`

Expected: valid schema.

Run: `npx prisma generate`

Expected: exit 0.

- [ ] **Step 5: Run a production Next.js build without mutating a database**

Run: `npx next build`

Expected: exit 0. Do not use the project `npm run build` script because it runs `prisma db push` against the configured database.

- [ ] **Step 6: Audit the anonymous response boundary**

Search all poll DTOs and API responses. Confirm no object contains both `voterEmail`/participant identity and `optionId`/`otherText`, and confirm open-poll responses never include `results`.

- [ ] **Step 7: Review the final diff and commit verification fixes if any**

Run: `git diff --check`

Expected: no whitespace errors.

If verification required changes:

```powershell
git add <only-poll-files-fixed>
git commit -m fix-verify-poll-system
```
