# Poll Engine Promotion Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the member polling system with intern/qualified-manager scopes, named ballots, configurable feedback and automatic approval settlement, then replace the legacy promotion voting flow with system-owned polls.

**Architecture:** Keep poll rules in dependency-free modules under `src/lib/polls`, add explicit electorate and named-ballot support in Prisma, and centralize all threshold decisions in one idempotent settlement service. Promotion request creation becomes a focused adapter that creates a system poll and maps its eventual outcome back to the existing admin-review lifecycle.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript, Prisma 7/PostgreSQL, Auth.js, next-intl, shadcn/Base UI, Vitest, React Testing Library.

---

## File map

- `prisma/schema.prisma`, `prisma/migrations/20260716140000_add_polls/migration.sql`: extended poll enums/fields, electorate, optional named voter, promotion relation, and final removal of `PromotionVote` in Task 5.
- `src/lib/polls/types.ts`: actor, audience, identity, feedback, approval and settlement DTO contracts.
- `src/lib/polls/rules.ts`: five-level identity matrix, poll/ballot validation and threshold calculation.
- `src/lib/polls/service.ts`: lifecycle, audience reads, anonymous/named writes and minimized DTOs.
- `src/lib/polls/settlement.ts`: idempotent close/tally/outcome transition and promotion status mapping.
- `src/lib/promotions/poll-adapter.ts`: create correctly configured system polls for both promotion types.
- `src/lib/polls/notifications.ts`: role-scope or explicit-electorate one-shot notification selection.
- `src/app/api/polls/**`, `src/app/api/cron/polls/route.ts`: thin authenticated mutation/read/cron adapters.
- `src/app/api/promotions/route.ts`, `src/app/api/promotions/[id]/review/route.ts`: unified-poll promotion creation and existing final review.
- Delete `src/app/api/promotions/vote/[token]/route.ts` and `src/app/[locale]/promotions/vote/[token]/page.tsx`.
- `src/components/dashboard/polls/**`, `src/app/[locale]/dashboard/polls/**`: identity labels, approval feedback, settlement controls/outcome and admin-only named details.
- `src/messages/{en,zh}.json`: complete bilingual additions.

### Task 1: Expand actor, scope and poll configuration rules

**Files:**
- Modify: `src/lib/polls/types.ts`
- Modify: `src/lib/polls/rules.ts`
- Modify: `src/lib/polls/rules.test.ts`
- Modify: `src/lib/polls/service.ts`

- [ ] **Step 1: Write failing identity-matrix and approval validation tests**

Add table-driven tests using this actor contract:

```ts
const member = { email: "member@example.com", role: "member", isIntern: false } as const;
const intern = { email: "intern@example.com", role: "manager", isIntern: true } as const;
const qualified = { email: "qualified@example.com", role: "manager", isIntern: false } as const;
const admin = { email: "admin@example.com", role: "admin", isIntern: false } as const;

it.each([
  [member, "member_plus", true],
  [member, "intern_manager_plus", false],
  [intern, "intern_manager_plus", true],
  [intern, "qualified_manager_plus", false],
  [qualified, "qualified_manager_plus", true],
  [admin, "admin", true],
] as const)("checks current identity for %s", (actor, scope, expected) => {
  expect(canActorAccessScope(actor, scope)).toBe(expected);
});

it("accepts approval settlement and feedback configuration", () => {
  expect(validatePollInput({
    title: "Promote candidate",
    description: "Review the application",
    kind: "approval",
    audienceMode: "role_scope",
    scope: "qualified_manager_plus",
    anonymous: false,
    feedbackPolicy: "required_on_reject",
    autoSettle: true,
    minimumParticipationBps: 5000,
    minimumApprovalBps: 6700,
    deadline: "2026-08-01T12:00:00.000Z",
    options: ["Approve", "Reject"],
  })).toMatchObject({ kind: "approval", minimumApprovalBps: 6700 });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/lib/polls/rules.test.ts`

Expected: FAIL because the new scope union, actor predicate and configuration fields do not exist.

- [ ] **Step 3: Implement the exact domain contracts and validators**

Define:

```ts
export type PollActor = {
  email: string;
  role: "member" | "manager" | "admin" | "dev";
  isIntern: boolean;
};
export type PollScope =
  | "member_plus"
  | "intern_manager_plus"
  | "qualified_manager_plus"
  | "admin";
export type PollKind = "choice" | "approval";
export type PollAudienceMode = "role_scope" | "explicit_list";
export type PollCreatorType = "admin" | "system";
export type PollFeedbackPolicy =
  | "disabled"
  | "optional"
  | "required_on_reject"
  | "required";
export type PollOutcome = "passed" | "rejected" | "no_quorum";
```

Replace `canRoleAccessScope` with `canActorAccessScope(actor, scope)`. Extend `validatePollInput` so choice polls reject settlement/feedback fields, approval polls require exactly two options, all basis-point values are integers from 0 through 10,000, and role-scope input requires a scope while explicit-list input does not accept one.

- [ ] **Step 4: Run the focused tests and TypeScript**

Run: `npm test -- src/lib/polls/rules.test.ts`

Expected: PASS.

Run: `npx tsc --noEmit`

Expected: errors only at known call sites still using `actor.role`; update those call sites to pass the complete actor without changing behavior yet, then rerun to exit 0.

- [ ] **Step 5: Commit the domain expansion**

```powershell
git add src/lib/polls/types.ts src/lib/polls/rules.ts src/lib/polls/rules.test.ts src/lib/polls/service.ts
git commit -m "feat: expand poll identity and configuration rules"
```

### Task 2: Extend the Prisma poll model while preserving a green intermediate state

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/migrations/20260716140000_add_polls/migration.sql`

- [ ] **Step 1: Update the Prisma schema**

Add Prisma enums corresponding exactly to Task 1 plus `PollOptionSemanticKey { approve reject }`. Change `Poll` to use nullable `scope` and `createdByEmail`, add `kind`, `audienceMode`, `anonymous`, `feedbackPolicy`, `creatorType`, settlement fields, `electorate`, and the optional promotion back-relation. Add:

```prisma
model PollElectorate {
  pollId     String   @map("poll_id")
  voterEmail String   @map("voter_email")
  createdAt  DateTime @default(now()) @map("created_at")
  poll       Poll     @relation(fields: [pollId], references: [id], onDelete: Cascade)
  voter      User     @relation(fields: [voterEmail], references: [email], onDelete: Cascade)

  @@id([pollId, voterEmail])
  @@index([voterEmail])
  @@map("poll_electorate")
}
```

Add nullable `semanticKey`, `feedback`, and `voterEmail` to the appropriate option/ballot models, with an optional voter relation and `@@unique([pollId, voterEmail])`. Add an optional unique `pollId` and poll relation to `PromotionRequest`. Keep `PromotionVote` temporarily so the repository compiles between tasks; Task 5 makes pollId required and removes the legacy model once all callers have moved.

- [ ] **Step 2: Update the unapplied poll migration with database checks**

Create the new enums/tables/columns directly in `20260716140000_add_polls/migration.sql`, add the nullable promotion `poll_id` foreign key, and include checks equivalent to:

```sql
CHECK (("creator_type" = 'admin' AND "created_by_email" IS NOT NULL)
    OR ("creator_type" = 'system' AND "created_by_email" IS NULL));
CHECK (("audience_mode" = 'role_scope' AND "scope" IS NOT NULL)
    OR ("audience_mode" = 'explicit_list' AND "scope" IS NULL));
```

The ballot anonymity invariant crosses `polls` and `poll_ballots`, so do not add an invalid single-table CHECK. Enforce it in the only ballot write service and cover it with transaction tests. Keep the option-vs-other XOR check and named-ballot unique index.

- [ ] **Step 3: Validate and generate**

Run: `npx prisma validate`

Expected: schema valid.

Run: `npx prisma generate`

Expected: client contains `PollElectorate`; the temporary `PromotionVote` delegate remains until Task 5.

- [ ] **Step 4: Run TypeScript and keep the checkpoint green**

Run: `npx tsc --noEmit`

Expected: exit 0 after updating poll repository shapes for the new required fields. Legacy promotion callers still compile because Task 2 has not removed `PromotionVote`.

- [ ] **Step 5: Commit the schema change**

```powershell
git add prisma/schema.prisma prisma/migrations/20260716140000_add_polls/migration.sql
git commit -m "feat: add named ballots and poll electorate schema"
```

### Task 3: Implement named ballots, explicit electorate and feedback

**Files:**
- Modify: `src/lib/polls/service.ts`
- Modify: `src/lib/polls/voting.test.ts`
- Modify: `src/lib/polls/service.test.ts`
- Modify: `src/app/api/polls/route.ts`
- Modify: `src/app/api/polls/[id]/route.ts`
- Modify: `src/app/api/polls/[id]/vote/route.ts`
- Create: `src/app/api/polls/[id]/named-ballots/route.ts`

- [ ] **Step 1: Write failing transaction and visibility tests**

Add tests proving the exact split:

```ts
it("never stores identity on an anonymous ballot with feedback", async () => {
  await submitBallot(db, member, "anonymous", {
    optionId: "reject", feedback: "Needs revision",
  }, now);
  expect(db.ballots[0]).toMatchObject({ feedback: "Needs revision" });
  expect(db.ballots[0]).not.toHaveProperty("voterEmail");
});

it("stores the voter only for a named ballot", async () => {
  await submitBallot(db, qualified, "named", {
    optionId: "approve", feedback: "Ready",
  }, now);
  expect(db.ballots[0]).toMatchObject({ voterEmail: qualified.email });
});

it("allows only electorate members to vote", async () => {
  await expect(submitBallot(db, qualified, "explicit", { optionId: "approve" }, now))
    .resolves.toEqual({ ok: true });
  await expect(submitBallot(db, intern, "explicit", { optionId: "approve" }, now))
    .rejects.toMatchObject({ code: "FORBIDDEN" });
});
```

Also test all feedback policies, named details forbidden while open, named details forbidden to non-admins after close, and anonymous polls returning no named details.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/lib/polls/voting.test.ts src/lib/polls/service.test.ts`

Expected: FAIL on missing feedback, voter and electorate behavior.

- [ ] **Step 3: Implement audience resolution and ballot writes**

Create a single `canActorVote(reader, actor, poll)` path: role scope calls `canActorAccessScope`; explicit list queries `(pollId, voterEmail)`. In the transaction, always create participation, then construct ballot data exactly as:

```ts
const ballotData = {
  pollId,
  optionId: ballot.optionId,
  otherText: ballot.otherText,
  feedback: ballot.feedback,
  ...(poll.anonymous ? {} : { voterEmail: actor.email }),
};
```

Add `listNamedBallots` that requires admin/dev, requires closed status and `anonymous === false`, and returns `{ email, name, optionLabel, semanticKey, feedback }`. Never add these fields to the ordinary detail DTO.

- [ ] **Step 4: Update thin HTTP adapters**

All routes build actors with `isIntern: session.user.isIntern === true`. The named-ballots route rechecks `polls.manage` and maps service errors through the existing HTTP helper.

- [ ] **Step 5: Run focused and complete poll tests**

Run: `npm test -- src/lib/polls src/app/api/polls`

Expected: PASS.

- [ ] **Step 6: Commit voting modes**

```powershell
git add src/lib/polls src/app/api/polls
git commit -m "feat: support named ballots and configurable feedback"
```

### Task 4: Add the idempotent automatic settlement service

**Files:**
- Create: `src/lib/polls/settlement.ts`
- Create: `src/lib/polls/settlement.test.ts`
- Modify: `src/lib/polls/service.ts`
- Modify: `src/app/api/polls/[id]/close/route.ts`
- Create: `src/app/api/cron/polls/route.ts`

- [ ] **Step 1: Write failing threshold and idempotency tests**

Test the pure calculation first:

```ts
it.each([
  [{ eligible: 10, cast: 0, approve: 0, participationBps: 0, approvalBps: 0 }, "no_quorum"],
  [{ eligible: 10, cast: 4, approve: 4, participationBps: 5000, approvalBps: 5000 }, "no_quorum"],
  [{ eligible: 10, cast: 5, approve: 2, participationBps: 5000, approvalBps: 5000 }, "rejected"],
  [{ eligible: 10, cast: 5, approve: 3, participationBps: 5000, approvalBps: 6000 }, "passed"],
] as const)("settles threshold boundaries", (input, expected) => {
  expect(calculatePollOutcome(input)).toBe(expected);
});

it("applies a settlement transition only once", async () => {
  const [first, second] = await Promise.all([
    settlePoll(db, "p1", now),
    settlePoll(db, "p1", now),
  ]);
  expect([first.changed, second.changed].sort()).toEqual([false, true]);
  expect(db.promotionUpdates).toHaveLength(1);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/lib/polls/settlement.test.ts`

Expected: FAIL because settlement functions are missing.

- [ ] **Step 3: Implement calculation and transactional settlement**

Export:

```ts
export function calculatePollOutcome(input: {
  eligible: number;
  cast: number;
  approve: number;
  participationBps: number;
  approvalBps: number;
}): PollOutcome;

export async function settlePoll(
  database: unknown,
  pollId: string,
  now?: Date,
): Promise<{ changed: boolean; outcome: PollOutcome | null; promotionId?: string }>;
```

Use integer cross-multiplication (`cast * 10_000 >= eligible * threshold`) rather than floats. Inside one database transaction, lock or conditionally update only a poll whose outcome is null, close it, write outcome/settledAt, and update related promotion to `pending_admin_review`, `rejected`, or `expired`.

- [ ] **Step 4: Connect all three triggers**

After a ballot transaction, settle only when autoSettle and every current eligible voter has participated. Admin close calls settle for admin-owned approval polls; reject close/extend requests for system polls. Cron authenticates with `CRON_SECRET`, finds deadline-expired open auto-settle polls, and calls the same service.

- [ ] **Step 5: Run focused tests and TypeScript**

Run: `npm test -- src/lib/polls/settlement.test.ts src/lib/polls/voting.test.ts src/lib/polls/service.test.ts`

Expected: PASS.

Run: `npx tsc --noEmit`

Expected: exit 0 for poll modules and routes.

- [ ] **Step 6: Commit settlement**

```powershell
git add src/lib/polls/settlement.ts src/lib/polls/settlement.test.ts src/lib/polls/service.ts src/app/api/polls src/app/api/cron/polls
git commit -m "feat: add idempotent poll settlement"
```

### Task 5: Replace promotion voting with system polls

**Files:**
- Create: `src/lib/promotions/poll-adapter.ts`
- Create: `src/lib/promotions/poll-adapter.test.ts`
- Modify: `prisma/schema.prisma`
- Modify: `prisma/migrations/20260716140000_add_polls/migration.sql`
- Modify: `src/app/api/promotions/route.ts`
- Modify: `src/app/api/cron/promotions/route.ts`
- Modify: `src/app/api/promotions/[id]/review/route.ts`
- Delete: `src/app/api/promotions/vote/[token]/route.ts`
- Delete: `src/app/[locale]/promotions/vote/[token]/page.tsx`
- Modify: `src/lib/email.ts`

- [ ] **Step 1: Write failing configuration tests for both promotion types**

```ts
it("creates a unanimous named referral poll", async () => {
  const result = await buildPromotionPollInput({
    type: "member_to_intern",
    candidateEmail: "member@example.com",
    voterEmails: ["one@example.com", "two@example.com"],
    deadline,
    approvalRatioPercent: 67,
  });
  expect(result).toMatchObject({
    creatorType: "system",
    audienceMode: "explicit_list",
    anonymous: false,
    feedbackPolicy: "required_on_reject",
    autoSettle: true,
    minimumParticipationBps: 10000,
    minimumApprovalBps: 10000,
  });
});

it("uses the configured approval ratio for qualified-manager promotion", async () => {
  const result = await buildPromotionPollInput({
    type: "intern_to_qualified",
    candidateEmail: "intern@example.com",
    voterEmails: ["qualified@example.com"],
    deadline,
    approvalRatioPercent: 67,
  });
  expect(result.minimumParticipationBps).toBe(0);
  expect(result.minimumApprovalBps).toBe(6700);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/lib/promotions/poll-adapter.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement atomic promotion and system-poll creation**

Move voter selection and poll configuration to `poll-adapter.ts`. Generate request and poll UUIDs before the Prisma transaction, then create Poll with two semantic options and electorate followed by PromotionRequest with the poll FK. Return `{ promotionRequest, poll }` so the route can schedule one-shot notifications after commit.

- [ ] **Step 4: Remove legacy token voting and invitation email calls**

Delete the token route/page, remove `PromotionVote` reads and `randomUUID` token creation, and remove calls to `sendPromotionReferralEmail`/`sendPromotionVoteEmail`. Keep final promotion result emails and the existing admin review mutation. Retire promotion cron vote tallying; deadline settlement now belongs to `/api/cron/polls`. In Prisma, make `PromotionRequest.pollId` required, remove `PromotionVote`, and finish the migration with `DROP TABLE "promotion_votes"` plus the non-null poll FK; the confirmed empty legacy table means no row conversion is needed.

- [ ] **Step 5: Connect settlement feedback to promotion outcomes**

Only the winning `settlePoll(...).changed === true` caller may schedule a rejection/expiry result notification. Pass de-identified reject feedback strings; never pass named voter fields to the applicant-facing notification.

- [ ] **Step 6: Run promotion, poll and TypeScript tests**

Run: `npm test -- src/lib/promotions src/lib/polls src/app/api/promotions`

Expected: PASS.

Run: `npx tsc --noEmit`

Expected: exit 0 with no references to `PromotionVote` or token vote routes.

- [ ] **Step 7: Commit promotion integration**

```powershell
git add src/lib/promotions src/lib/email.ts src/app/api/promotions src/app/api/cron/promotions prisma
git add -u src/app/api/promotions/vote src/app/[locale]/promotions/vote
git commit -m "feat: migrate promotion voting to system polls"
```

### Task 6: Update notifications for qualified scopes and electorates

**Files:**
- Modify: `src/lib/polls/notifications.ts`
- Modify: `src/lib/polls/notifications.test.ts`
- Modify: `src/lib/notify/messages.ts`
- Modify: `src/app/api/polls/[id]/publish/route.ts`
- Modify: `src/app/api/promotions/route.ts`

- [ ] **Step 1: Write failing audience tests**

Cover member+, intern+, qualified+, admin and explicit electorate. The qualified test must reject `{ role: "manager", managerProfile: { intern: true } }` and include `{ role: "manager", managerProfile: { intern: false } }`. Explicit lists must notify exactly the electorate emails and must not query by role.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/lib/polls/notifications.test.ts`

Expected: FAIL because notification dependencies only accept role arrays.

- [ ] **Step 3: Implement one audience resolver**

Change `notifyPollAudience` dependencies to expose `findRoleScopeUsers(scope)` and `findElectorateUsers(pollId)`. Choose exactly one based on audienceMode, deduplicate emails, build the existing `poll_published` dispatch, and call `notify` once per user with per-user error logging and no retry.

- [ ] **Step 4: Schedule notifications for system promotion polls**

After successful promotion request creation, use Next.js `after()` to call `notifyPublishedPoll`. Do not call any email invitation function. A notification failure must not roll back the promotion request.

- [ ] **Step 5: Run notification and integration tests**

Run: `npm test -- src/lib/polls/notifications.test.ts src/lib/promotions/poll-adapter.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit notification changes**

```powershell
git add src/lib/polls/notifications.ts src/lib/polls/notifications.test.ts src/lib/notify/messages.ts src/app/api/polls/[id]/publish/route.ts src/app/api/promotions/route.ts
git commit -m "feat: notify poll electorates and qualified scopes"
```

### Task 7: Extend member and admin poll UI

**Files:**
- Modify: `src/components/dashboard/polls/poll-editor.tsx`
- Modify: `src/components/dashboard/polls/poll-editor.test.tsx`
- Modify: `src/components/dashboard/polls/poll-vote-form.tsx`
- Modify: `src/components/dashboard/polls/poll-vote-form.test.tsx`
- Modify: `src/components/dashboard/polls/poll-results.tsx`
- Modify: `src/components/dashboard/polls/poll-admin-actions.tsx`
- Create: `src/components/dashboard/polls/named-ballots.tsx`
- Modify: `src/app/[locale]/dashboard/polls/page.tsx`
- Modify: `src/app/[locale]/dashboard/polls/[id]/page.tsx`
- Modify: `src/app/[locale]/dashboard/polls/[id]/manage/page.tsx`
- Modify: `src/app/[locale]/dashboard/polls/new/page.tsx`
- Modify: `src/messages/en.json`
- Modify: `src/messages/zh.json`

- [ ] **Step 1: Write failing editor and vote-form tests**

Editor tests must assert four scopes, anonymous default, approval-only settlement fields, and validation that choice disables feedback/settlement. Vote-form tests must assert identity warning text, feedback visibility/requiredness and the payload `{ optionId, feedback }`.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/components/dashboard/polls/poll-editor.test.tsx src/components/dashboard/polls/poll-vote-form.test.tsx`

Expected: FAIL on missing controls and feedback behavior.

- [ ] **Step 3: Implement conditional authoring controls**

Add native/selectable controls for `kind`, four role scopes, anonymous/named and feedbackPolicy. Only approval may render autoSettle and percentage inputs; convert display percentage to basis points with `Math.round(Number(value) * 100)`. Keep anonymous checked by default.

- [ ] **Step 4: Implement identity-aware voting and results**

Display a prominent identity badge on list/detail/confirmation. Approval uses the semantic approve/reject options and conditionally renders a 1,000-character feedback textarea. Closed ordinary detail shows aggregate outcome only. The manage Server Component calls `listNamedBallots` directly only after a named poll closes and renders identity, choice and feedback; it never calls that service for anonymous polls.

- [ ] **Step 5: Add promotion context and system restrictions**

When detail DTO includes promotion context, render candidate name, promotion type, application text and attendance/management stats. In manage view label creatorType system and omit edit, deadline and close controls for system polls.

- [ ] **Step 6: Add complete bilingual copy and run UI tests**

Run: `npm test -- src/components/dashboard/polls`

Expected: PASS.

- [ ] **Step 7: Commit UI changes**

```powershell
git add src/components/dashboard/polls src/app/[locale]/dashboard/polls src/messages/en.json src/messages/zh.json
git commit -m "feat: add named approval poll experience"
```

### Task 8: Final verification and PR update

**Files:**
- Modify only files exposed by verification defects.

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: all test files pass, including new scope, named ballot, settlement and promotion suites.

- [ ] **Step 2: Run targeted lint and TypeScript**

Run ESLint with literal-path file lists for all poll/promotion files because Windows treats `[locale]` as a glob token.

Expected: 0 errors in modified files. Record unrelated repository-wide lint debt separately.

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 3: Validate Prisma and production build**

Run: `npx prisma validate`

Expected: schema valid.

Run: `npx prisma generate`

Expected: successful client generation.

Run: `npx next build`

Expected: production build succeeds. Do not run `npm run build`, which performs a database push.

- [ ] **Step 4: Audit privacy and settlement boundaries**

Search all ordinary poll DTOs and API responses: anonymous responses must never combine voter identity with option/feedback; open responses must never include tallies, named detail or feedback. Confirm only `named-ballots` returns voter-choice mappings, only after close and only to admin/dev. Confirm one conditional settlement transition performs at most one promotion update.

- [ ] **Step 5: Review diff, commit verification fixes and push**

Run: `git diff --check`

Expected: no whitespace errors.

If verification changes code:

```powershell
git add <explicit-verified-files>
git commit -m "fix: verify poll settlement integration"
```

Push the completed branch and update Draft PR #33 without force-pushing.
