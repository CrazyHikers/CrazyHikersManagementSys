// Result shape used by template `validateFormData` hooks. Generic over
// the validated data type so each template can return its own typed
// payload while the dispatcher only needs the `ok` discriminator.

export type ValidationResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; errors: { field: string; message: string }[] };
