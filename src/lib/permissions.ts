import { auth } from "./auth";

export type UserRole = "admin" | "manager" | "member";

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
  // Waivers
  | "waivers.approve"
  // Managers
  | "managers.list"
  | "managers.create"
  // Promotions
  | "promotions.request"
  | "promotions.vote"
  | "promotions.review"
  // Settings
  | "settings.view"
  | "settings.edit"
  // Upload
  | "upload.files";

/**
 * Central permission matrix.
 * Each permission maps to the roles that are allowed to perform it.
 * To add a new role, just add it to the relevant permission arrays.
 */
const permissionMatrix: Record<Permission, UserRole[]> = {
  // Activities
  "activities.create": ["manager", "admin"],
  "activities.edit": ["manager", "admin"],
  "activities.viewOwn": ["manager", "admin"],
  "activities.viewAll": ["admin"],
  "activities.finish": ["manager", "admin"],
  "activities.cancel": ["manager", "admin"],

  // Registrations
  "registrations.manage": ["manager", "admin"],
  "registrations.flag": ["manager", "admin"],

  // Members
  "members.list": ["admin"],
  "members.viewDetail": ["manager", "admin"],

  // Waivers
  "waivers.approve": ["admin"],

  // Managers
  "managers.list": ["admin"],
  "managers.create": ["admin"],

  // Promotions
  "promotions.request": ["member", "manager", "admin"],
  "promotions.vote": ["manager", "admin"],
  "promotions.review": ["admin"],

  // Settings
  "settings.view": ["admin"],
  "settings.edit": ["admin"],

  // Upload
  "upload.files": ["member", "manager", "admin"],
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
