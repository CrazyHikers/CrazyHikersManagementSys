import type { ComponentType } from "react";
import type { ActivityCardProps } from "@/components/activity-card/activity-card-types";
import type { LandingProps } from "@/components/events/template-types";
import type {
  ManagerExtrasProps,
  PerRegistrationExtrasProps,
} from "@/components/dashboard/template-extras-types";
import type { ValidationResult } from "./validation-types";
import { matchmaking520Def } from "@/components/events/matchmaking-520/template-def";

// One TemplateDef per template. Every per-template customization lives
// inside its def. Generic surfaces (homepage card, activity detail page,
// manager registration list, register API) read from this registry
// rather than branching on tag strings.
//
// To add a new template:
//   1. Create src/components/events/<name>/template-def.tsx exporting a TemplateDef
//   2. Add a key here mapping the tag to that def
// Both compile-time (TemplateTag union) and request-time (isKnownTemplate)
// checks will then accept the new tag.

export type TemplateDef = {
  label: string;

  // ---- Override-style hooks: when present, replace the default UI ----

  /** Homepage activity card. When omitted the default card is used. */
  Card?: ComponentType<ActivityCardProps>;

  /**
   * Bespoke landing for the public activity detail page. Lazy-loaded so
   * each template's chunk only ships when that template is rendered.
   * When omitted the default detail page is rendered.
   */
  loadLanding?: () => Promise<ComponentType<LandingProps>>;

  // ---- Additive-style hooks: when present, inject extra content ----

  /**
   * Server-side validation for the registration formData. Runs in the
   * register API before the row is created. When omitted, no
   * template-specific validation runs.
   */
  validateFormData?: (raw: unknown) => ValidationResult;

  /** Rendered once above the manager registration list. */
  ManagerExtras?: ComponentType<ManagerExtrasProps>;

  /** Rendered inside each manager registration card. */
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

/**
 * Look up a template's def by tag, returning undefined for unknown
 * strings (including null/empty input). Callers can then safely use
 * optional chaining: `getTemplate(tag)?.Card`.
 */
export function getTemplate(tag: string | null | undefined):
  | TemplateDef
  | undefined {
  if (!tag || !isKnownTemplate(tag)) return undefined;
  return TEMPLATES[tag];
}
