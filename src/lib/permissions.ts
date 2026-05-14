import { auth } from "./auth";

export type UserRole = "dev" | "admin" | "manager" | "member";

export type Permission =
  // Activities
  | "activities.create"
  | "activities.edit"
  | "activities.viewOwn"
  | "activities.viewAll"
  | "activities.finish"
  | "activities.cancel"
  // Registrations
  | "registrations.manage"
  | "registrations.approve"
  | "registrations.propose"
  | "registrations.flag"
  // Members
  | "members.list"
  | "members.viewDetail"
  | "members.delete"
  // Flags
  | "flags.manage"
  // Waivers
  | "waivers.approve"
  // Managers
  | "managers.list"
  // Promotions
  | "promotions.request"
  | "promotions.vote"
  | "promotions.review"
  // Settings
  | "settings.view"
  | "settings.edit"
  // Upload
  | "upload.files"
  // Intern resources (training files visible to intern managers + admins)
  | "intern_resources:read"
  | "intern_resources:manage"
  // Dev-only
  | "users.changeRole"
  | "activities.changeTemplate"
  | "activities.editSlug";

/**
 * Central permission matrix.
 * Each permission maps to the roles that are allowed to perform it.
 * To add a new role, just add it to the relevant permission arrays.
 *
 * Role hierarchy (for reference, not enforced):
 *   dev > admin > manager > member
 */
const permissionMatrix: Record<Permission, UserRole[]> = {
  // Activities
  "activities.create": ["manager", "admin", "dev"],
  "activities.edit": ["manager", "admin", "dev"],
  "activities.viewOwn": ["manager", "admin", "dev"],
  "activities.viewAll": ["admin", "dev"],
  "activities.finish": ["manager", "admin", "dev"],
  "activities.cancel": ["manager", "admin", "dev"],

  // Registrations
  "registrations.manage": ["manager", "admin", "dev"],
  // `approve` is the registration_confirmed transition. Role-only check;
  // intern managers also need to clear isInternManager() — see below.
  "registrations.approve": ["manager", "admin", "dev"],
  // `propose` is the soft-endorsement intern managers leave on a pending
  // registration. Role-only check here; non-intern managers fail the
  // additional canProposeRegistration() check below.
  "registrations.propose": ["manager"],
  "registrations.flag": ["manager", "admin", "dev"],

  // Members
  "members.list": ["admin", "dev"],
  "members.viewDetail": ["admin", "dev"],
  "members.delete": ["admin", "dev"],

  // Flags
  "flags.manage": ["admin", "dev"],

  // Waivers
  "waivers.approve": ["admin", "dev"],

  // Managers
  "managers.list": ["admin", "dev"],

  // Promotions
  "promotions.request": ["member", "manager", "admin", "dev"],
  "promotions.vote": ["manager", "admin", "dev"],
  "promotions.review": ["admin", "dev"],

  // Settings
  "settings.view": ["admin", "dev"],
  "settings.edit": ["admin", "dev"],

  // Upload
  "upload.files": ["member", "manager", "admin", "dev"],

  // Intern resources. Read is granted to admins/dev directly; intern managers
  // are layered on inside `can()` since the matrix is purely role-driven.
  "intern_resources:read": ["admin", "dev"],
  "intern_resources:manage": ["admin", "dev"],

  // Dev-only: directly change any user's role
  "users.changeRole": ["dev"],
  // Dev-only: set/clear `Activity.metadata.template` from the dashboard
  // (used to flip an activity into a bespoke landing template like
  // matchmaking_520 without DB access).
  "activities.changeTemplate": ["dev"],
  // Dev-only: set/clear `Activity.metadata.slug` from the dashboard.
  // Slugs feed the `/events/<slug>` alias redirect; uniqueness is
  // enforced at write time in the PATCH route.
  "activities.editSlug": ["dev"],
};

/**
 * Check if a role has a specific permission.
 */
export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  const allowed = permissionMatrix[permission];
  return allowed ? allowed.includes(role) : false;
}

/**
 * Check if a session user has a specific permission.
 * Works with any object that has a user.role field.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function can(session: any, permission: Permission): boolean {
  const role = (session?.user?.role as UserRole) || "member";
  if (roleHasPermission(role, permission)) return true;
  // Intern managers (manager role + ManagerProfile.intern) can read intern
  // resources even though the matrix only lists admins/dev. The matrix
  // stays role-only; the role+flag combo is layered here.
  if (permission === "intern_resources:read" && isInternManager(session)) {
    return true;
  }
  return false;
}

/**
 * Get the user's role from session. Falls back to "member".
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getUserRole(session: any): UserRole {
  return (session?.user?.role as UserRole) || "member";
}

/**
 * True for managers whose ManagerProfile.intern is still true.
 * `isIntern` is populated on the JWT in the auth callbacks.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isInternManager(session: any): boolean {
  return getUserRole(session) === "manager" && session?.user?.isIntern === true;
}

/**
 * Approving a registration into an activity (status → registration_confirmed)
 * requires the manage permission AND that the actor is not an intern manager.
 * Interns can do every other registration op (mark attended/absent, flag, edit).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function canApproveRegistrations(session: any): boolean {
  return can(session, "registrations.approve") && !isInternManager(session);
}

/**
 * Proposing/withdrawing a registration is reserved for intern managers —
 * it's the soft-endorsement counterpart to approve.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function canProposeRegistration(session: any): boolean {
  return can(session, "registrations.propose") && isInternManager(session);
}

/**
 * Server-side helper: get current session and check permission.
 * Returns the session if authorized, null otherwise.
 */
export async function authorize(permission: Permission) {
  const session = await auth();
  if (!session?.user) return null;
  if (!can(session, permission)) return null;
  return session;
}
