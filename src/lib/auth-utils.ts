import { auth } from "./auth";

export type UserRole = "admin" | "manager" | "member";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  member: 0,
  manager: 1,
  admin: 2,
};

export async function getSession() {
  const session = await auth();
  if (!session?.user?.email) return null;
  return session;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireRole(minRole: UserRole) {
  const session = await requireAuth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userRole = ((session.user as any).role as UserRole) || "member";
  if (ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[minRole]) {
    throw new Error("Forbidden");
  }
  return session;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getUserRole(session: any): UserRole {
  return (session?.user?.role as UserRole) || "member";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function hasRole(session: any, minRole: UserRole): boolean {
  const role = getUserRole(session);
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];
}
