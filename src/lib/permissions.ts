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
  | "registrations.flag"
  // Members
  | "members.list"
  | "members.viewDetail"
  | "members.delete"
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
  // Dev-only
  | "users.changeRole";

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
  "registrations.flag": ["manager", "admin", "dev"],

  // Members
  "members.list": ["admin", "dev"],
  "members.viewDetail": ["manager", "admin", "dev"],
  "members.delete": ["admin", "dev"],

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

  // Dev-only: directly change any user's role
  "users.changeRole": ["dev"],
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
  return roleHasPermission(role, permission);
}

/**
 * Get the user's role from session. Falls back to "member".
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getUserRole(session: any): UserRole {
  return (session?.user?.role as UserRole) || "member";
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
