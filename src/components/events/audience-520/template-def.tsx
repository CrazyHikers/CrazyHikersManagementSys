import type { TemplateDef } from "@/lib/events/templates";
import { validateAudience520 } from "@/lib/events/audience-520";

// Audience side of the 5·20 event. Pairs visually with matchmaking_520
// but collects only light logistical info, so the manager dashboard's
// default registration list is enough — no Card / ManagerExtras /
// PerRegistrationExtras overrides needed (yet).
export const audience520Def: TemplateDef = {
  label: "5·20 audience landing",
  loadLanding: () =>
    import("./Audience520Landing").then((m) => m.Audience520Landing),
  validateFormData: validateAudience520,
};
