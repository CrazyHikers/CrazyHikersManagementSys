# Template Registry — Design

## Background

Today, an activity becomes a "bespoke template" (currently only `matchmaking_520`) by writing the string `matchmaking_520` into `Activity.metadata.template`. The known-tag list shown in the dev dashboard is derived by scanning existing rows, so the first time a tag is used the dev must type it by hand into a "Custom…" input. The validating regex on the API side accepts any `[a-zA-Z0-9_-]+` string — a typo is silently allowed and shows up as a "(none)"-like state on the page because no consumer matches it.

The bespoke template's own code is well-isolated under `src/components/events/matchmaking-520/` and `src/lib/events/matchmaking-520.ts`, but the patches it makes into otherwise-generic logic are scattered across four files:

| # | Generic file | Patch shape | Patch type |
|---|---|---|---|
| 1 | `src/app/[locale]/activities/[id]/page.tsx` | `if (template === "matchmaking_520") return <Matchmaking520Landing .../>` | replace whole page |
| 2 | `src/components/activity-card.tsx` | `const isMatchmaking = template === MATCHMAKING_520_TEMPLATE` + many forks | visual decoration |
| 3 | `src/components/dashboard/registration-manager.tsx` | two `{template === MATCHMAKING_520_TEMPLATE && ...}` blocks | additive dashboard sections |
| 4 | `src/app/api/activities/[id]/register/route.ts` | `if (...template === "matchmaking_520") validateMatchmaking520(formData)` | extra form-data validation |

Adding a second or third template under the current shape would multiply these `if` branches in each generic file. The four files would become an "everything-knows-about-everything" hub.

## Goals

1. Move the set of known templates from "DB-derived" to "code-declared", so the very first use of a new template is fully autocompleted.
2. Make TypeScript catch unknown / misspelled tags at compile time, and the API reject them at request time.
3. Centralize every customization a template makes into one definition, so reading a single file tells you exactly what a template overrides or adds. Removing a template is symmetric: delete one file + one registry entry.
4. Keep adding additional templates cheap: a new template is one new directory plus one line in the registry — generic files do not change.

## Non-goals

- Reworking the existing matchmaking_520 UI or its data model.
- Allowing templates to inject UI at arbitrary new positions beyond the four patch points above. New positions can be added later as needs arise.
- A plugin or remote-loading system. Templates are part of the codebase.

## Architecture

### Two patch shapes, two patterns

We deliberately use two patterns based on how a template wants to customize a surface:

- **Override-style** — the template fully takes over a position. Example: the homepage activity card and the public detail page. Pattern: dispatcher swaps in the template's component when present, otherwise renders the default. The template provides a complete component.
- **Additive-style** — the template adds an optional extra to an otherwise-generic surface. Example: the BalanceCard and AnswersDrawer that appear in the manager dashboard for m520, and the formData validator that runs in the register API. Pattern: generic code calls the optional registry hook once.

This split is the core architectural decision. It avoids a uniform-but-awkward slot abstraction over visuals while still ending up with one file per template that owns all its customizations.

### Registry shape

`src/lib/events/templates.ts` is the single source of truth:

```ts
import type { ComponentType } from "react";
import type { ActivityCardProps } from "@/components/activity-card-types";
import type { LandingProps } from "@/components/events/template-types";
import type { ManagerExtrasProps } from "@/components/dashboard/template-extras-types";
import type { ValidationResult } from "@/lib/events/validation-types";
import { matchmaking520Def } from "@/components/events/matchmaking-520/template-def";

export type TemplateDef = {
  label: string;

  // Override-style
  Card?: ComponentType<ActivityCardProps>;
  loadLanding?: () => Promise<ComponentType<LandingProps>>;

  // Additive-style
  validateFormData?: (raw: unknown) => ValidationResult;
  /** Rendered once above the registration list. */
  ManagerExtras?: ComponentType<ManagerExtrasProps>;
  /** Rendered inside each registration card. */
  PerRegistrationExtras?: ComponentType<PerRegistrationExtrasProps>;
};

export const TEMPLATES = {
  matchmaking_520: matchmaking520Def,
} as const satisfies Record<string, TemplateDef>;

export type TemplateTag = keyof typeof TEMPLATES;
export const TEMPLATE_TAGS = Object.keys(TEMPLATES) as TemplateTag[];
export function isKnownTemplate(s: string): s is TemplateTag {
  return Object.prototype.hasOwnProperty.call(TEMPLATES, s);
}
```

Each template provides its own def file colocated with its UI code, so the registry stays a thin import-and-collect file:

```ts
// src/components/events/matchmaking-520/template-def.tsx
import type { TemplateDef } from "@/lib/events/templates";
import { Matchmaking520Card } from "./Matchmaking520Card";
import { Matchmaking520ManagerExtras } from "./Matchmaking520ManagerExtras";
import { validateMatchmaking520 } from "@/lib/events/matchmaking-520";

export const matchmaking520Def: TemplateDef = {
  label: "5·20 matchmaking landing",
  Card: Matchmaking520Card,
  loadLanding: () =>
    import("./Matchmaking520Landing").then((m) => m.Matchmaking520Landing),
  validateFormData: validateMatchmaking520,
  ManagerExtras: Matchmaking520ManagerExtras,           // BalanceCard
  PerRegistrationExtras: Matchmaking520AnswersExtras,   // AnswersDrawer per row
};
```

The existing `MATCHMAKING_520_TEMPLATE` constant stays but is typed against the registry to catch divergence at compile time:

```ts
import type { TemplateTag } from "@/lib/events/templates";
export const MATCHMAKING_520_TEMPLATE = "matchmaking_520" satisfies TemplateTag;
```

### Loading strategy

- `Card`: static import. The homepage list shows all open activities, so every template's card may be needed; lazy loading would just add request waterfalls without benefit.
- `loadLanding`: lazy via dynamic `import()`. Only one landing renders per page view, so we keep the matching template's chunk out of the rest of the app's bundle.
- `validateFormData`: static import. The validator function is small and the register route runs server-side where chunking matters less.
- `ManagerExtras`: static import. Only the dashboard renders it, but it's a single small component per template; chunking adds complexity for little gain.

### Card parts (shared building blocks)

Without DRY, each template's card would re-implement date/deadline/capacity/manager-list/register-button rendering. We extract those into a small set of subcomponents that each card composes:

```
src/components/activity-card/
├── parts.tsx          // CardDate, CardSpotsLeftBadge, CardManagerLine, CardRegisterButton
├── DefaultActivityCard.tsx
└── activity-card-types.ts   // ActivityCardProps
```

Each card decides which parts to use and how to style them. New badges or display features added later end up as new parts; the default card uses them, and each template-specific card decides whether to adopt them — that selectivity is wanted, not a downside.

### Size & layout

Cards are responsible for their own width/height. The homepage list uses a vertical stack with `w-full` per card. We do not enforce dimensions via types — if a template card breaks the rhythm it is visually obvious in review.

## Component plan

### New files

- `src/lib/events/templates.ts` — registry + types + `isKnownTemplate`
- `src/lib/events/validation-types.ts` — `ValidationResult` type (re-exported from existing matchmaking-520 shape)
- `src/components/activity-card/activity-card-types.ts` — `ActivityCardProps`
- `src/components/activity-card/parts.tsx` — shared subcomponents
- `src/components/activity-card/DefaultActivityCard.tsx` — non-template card, extracted from current `activity-card.tsx` minus the `isMatchmaking` branches
- `src/components/events/template-types.ts` — `LandingProps`
- `src/components/dashboard/template-extras-types.ts` — `ManagerExtrasProps` and `PerRegistrationExtrasProps`
- `src/components/events/matchmaking-520/Matchmaking520Card.tsx` — extracted from current `activity-card.tsx`'s `isMatchmaking` paths
- `src/components/events/matchmaking-520/Matchmaking520ManagerExtras.tsx` — wraps `BalanceCard` (rendered once above the list)
- `src/components/events/matchmaking-520/Matchmaking520AnswersExtras.tsx` — wraps `AnswersDrawer` (rendered per registration row)
- `src/components/events/matchmaking-520/template-def.tsx` — m520's TemplateDef

### Changed files

- `src/components/activity-card.tsx` — becomes a thin dispatcher: pick `TEMPLATES[template]?.Card ?? DefaultActivityCard` and render it
- `src/app/[locale]/activities/[id]/page.tsx` — replace the hard-coded `if (template === "matchmaking_520")` branch with `def?.loadLanding`
- `src/components/dashboard/registration-manager.tsx` — replace the two `{template === MATCHMAKING_520_TEMPLATE && ...}` blocks with a single `<def.ManagerExtras .../>` (when present). The `BalanceCard` and `AnswersDrawer` imports move out of this file.
- `src/app/api/activities/[id]/register/route.ts` — replace the hard-coded check with `def?.validateFormData`
- `src/app/api/activities/[id]/template/route.ts` — replace the regex with `isKnownTemplate`, return a 400 with "add it to `src/lib/events/templates.ts` first" when unknown
- `src/components/dashboard/dev-activity-controls.tsx` — remove `CUSTOM_SENTINEL` and the custom-input UI; list comes from `TEMPLATE_TAGS`. Show the current value as a disabled `(legacy)` item if it's not in the registry, so the user can switch off it.
- `src/app/[locale]/dashboard/activity-view/[id]/page.tsx` — drop the `db.activity.findMany({ select: { metadata: true } })` scan; pass `TEMPLATE_TAGS` to `DevActivityControls`
- `src/lib/events/matchmaking-520.ts` — re-type `MATCHMAKING_520_TEMPLATE` with `satisfies TemplateTag`

## Data flow

### Render an activity card on the homepage

1. `src/app/[locale]/page.tsx` builds `activityData[]` (today already includes `template`).
2. `<ActivityList>` maps each activity to `<ActivityCard {...props} />`.
3. `<ActivityCard>` picks `Card = TEMPLATES[template]?.Card ?? DefaultActivityCard` and returns `<Card {...props} />`.
4. The chosen card composes shared parts from `parts.tsx`.

### Render an activity detail page

1. `src/app/[locale]/activities/[id]/page.tsx` fetches the activity, computes `def = isKnownTemplate(template) ? TEMPLATES[template] : undefined`.
2. If `def?.loadLanding` is present: `const Landing = await def.loadLanding(); return <SiteHeader /><Landing activity={activity} locale={locale} isOpen={isOpen} isFull={isFull} /><SiteFooter />`.
3. Otherwise render the default detail page (today's code below the early return).

### Submit a registration

1. `POST /api/activities/[id]/register` reads `template` from the activity.
2. If `def?.validateFormData` is present, run it against the incoming `formData`. On failure return `400 INVALID_FORM_DATA`.
3. Otherwise skip the template-specific validation.

### Manager dashboard registration list

1. `<RegistrationManager>` receives `template` (already passed today).
2. After the standard list it renders `{def?.ManagerExtras ? <def.ManagerExtras registrations={registrations} publicUrlPrefix={publicUrlPrefix} /> : null}`.
3. `Matchmaking520ManagerExtras` internally renders the top-of-list `<BalanceCard>` and the per-registration `<AnswersDrawer>` block.

Note: the manager surface has two distinct injection points (top-of-list vs per-row), so `TemplateDef` exposes two hooks. Both are optional; m520 supplies both. Inside the per-registration loop, the dispatcher reads:

```tsx
{def?.PerRegistrationExtras && (
  <def.PerRegistrationExtras reg={reg} publicUrlPrefix={publicUrlPrefix} />
)}
```

## Error handling

- Unknown tag arriving at the template PATCH API: 400 with a developer-readable message naming the registry file.
- Activity in DB with a template string not in the registry (e.g., legacy or test data): the dispatcher falls through to defaults — homepage card uses `DefaultActivityCard`, detail page uses the default route, manager dashboard hides extras, register API skips the validator. The dev controls show the current value as a disabled `(legacy)` item so a dev can clear it.
- Lazy `loadLanding()` rejects (chunk fetch failure): allow the error to bubble; Next.js error boundary handles it. Activity-detail is a server component, so this is a render error, not a runtime UI crash.

## Validation strategy

- Compile time: `TemplateTag` union derived from `TEMPLATES` keys catches misspellings anywhere the type is used; `satisfies TemplateTag` on each module's tag constant catches divergence between the constant and the registry key.
- Request time: API uses `isKnownTemplate` to reject unknown tags. The accepted character set (`[a-zA-Z0-9_-]+`) is no longer enforced separately — registry membership is the only gate.
- Read time: every reader uses `isKnownTemplate(s) ? TEMPLATES[s] : undefined`, so unknown strings degrade gracefully.

## Testing approach

Manual / browser:

- Existing m520 activity renders the bespoke landing, the card uses the m520 theme, the BalanceCard appears in the dashboard, the AnswersDrawer opens for each registration. (Regression — no observable change for the only existing template.)
- Set an activity's template to a known tag via dev controls — works; dropdown shows only registry tags + `(none)`.
- Attempt `PATCH /api/activities/<id>/template { "template": "made_up" }` — returns 400 with the registry-file hint.
- Insert a row with `metadata.template = "legacy_thing"` directly in the DB — homepage card renders as default, detail page renders as default, dev controls show `(legacy)`.
- Submit a registration to a non-template activity — no validator runs.
- Submit a registration to the m520 activity with bad formData — returns the same 400 as today.

Not in scope: automated tests (the project has no test harness today; introducing one is its own task).

## Migration / backwards compatibility

- DB rows: no migration. The only template tag in use is already in the registry.
- Code: `MATCHMAKING_520_TEMPLATE` constant stays exported. Anywhere downstream code imports it continues to work; its value just gets a stricter type.

## Open questions deferred to future work

- When a second template appears, will the current set of registry hooks cover what it needs? If not, the answer is to add a new optional hook (additive change, doesn't break m520). We do not try to predict those hooks now.
- Do we eventually want a "register a new template" CLI scaffolder that creates the directory layout? Useful if templates become frequent, premature today.
