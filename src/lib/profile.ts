const REQUIRED_STRING_FIELDS = [
  "emergencyContact",
  "emergencyPhone",
  "gender",
  "organization",
  "position",
  "fiveKmPace",
  "maxElevationGain",
  "maxElevationLoss",
  "navigationSoftware",
  "selfIntro",
] as const;

const REQUIRED_ARRAY_FIELDS = [
  "fitnessActivities",
  "equipment",
  "quizManagerDuties",
  "quizMemberDuties",
  "insurance",
] as const;

const REQUIRED_BOOLEAN_FIELDS = [
  "canDoEquipmentCheck",
  "followsCrazyHikers",
] as const;

/**
 * Returns the list of profile field names that are missing or empty.
 */
export function getMissingProfileFields(profile: unknown): string[] {
  const missing: string[] = [];
  const p = (profile && typeof profile === "object" ? profile : {}) as Record<string, unknown>;

  for (const field of REQUIRED_STRING_FIELDS) {
    const val = p[field];
    if (typeof val !== "string" || !val.trim()) {
      missing.push(field);
    }
  }

  for (const field of REQUIRED_ARRAY_FIELDS) {
    const val = p[field];
    if (!Array.isArray(val) || val.length === 0) {
      missing.push(field);
    }
  }

  for (const field of REQUIRED_BOOLEAN_FIELDS) {
    if (typeof p[field] !== "boolean") {
      missing.push(field);
    }
  }

  return missing;
}

/**
 * Returns true if all required profile fields are filled.
 */
export function isProfileComplete(profile: unknown): boolean {
  return getMissingProfileFields(profile).length === 0;
}
