// Props for the two additive UI hooks templates can plug into the
// manager dashboard. Both hooks are optional; templates that don't need
// them simply omit the field.

// Minimal shape — templates that need more fields can narrow this when
// declaring their own component. Kept narrow to avoid coupling the
// registry to RegistrationManager's full Registration type.
export type RegistrationLike = {
  status: string;
  formData?: Record<string, unknown> | null;
};

export type ManagerExtrasProps = {
  registrations: RegistrationLike[];
  publicUrlPrefix: string | null;
};

export type PerRegistrationExtrasProps = {
  reg: RegistrationLike;
  publicUrlPrefix: string | null;
};
