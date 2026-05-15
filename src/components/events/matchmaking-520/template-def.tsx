import type { TemplateDef } from "@/lib/events/templates";
import { validateMatchmaking520 } from "@/lib/events/matchmaking-520";
import { Matchmaking520Card } from "./Matchmaking520Card";
import { Matchmaking520ManagerExtras } from "./Matchmaking520ManagerExtras";
import { Matchmaking520AnswersExtras } from "./Matchmaking520AnswersExtras";

// Single point that wires the 5·20 template into all four patch points
// (homepage card, public landing page, manager dashboard top section,
// manager dashboard per-registration row, register API validation).
// Removing this template = delete this file + remove its key from
// src/lib/events/templates.ts.
export const matchmaking520Def: TemplateDef = {
  label: "5·20 matchmaking landing",
  Card: Matchmaking520Card,
  loadLanding: () =>
    import("./Matchmaking520Landing").then((m) => m.Matchmaking520Landing),
  validateFormData: validateMatchmaking520,
  ManagerExtras: Matchmaking520ManagerExtras,
  PerRegistrationExtras: Matchmaking520AnswersExtras,
};
