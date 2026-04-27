import {
  getUserRoleLabel,
  normalizeUserRole,
  type UserRole,
} from "@backend/modules/auth/auth.types";
import { pool } from "@backend/shared/db/pool";

type SessionUserIdentity = {
  email: string;
  role: UserRole;
  displayName: string;
};

type SessionUserFallback = {
  email: string;
  role: string;
};

async function findPersistedUserById(userId: number) {
  return pool.query<{ email: string; role: string }>(
    `
      SELECT "email", "role"
      FROM "User"
      WHERE "id" = $1
      LIMIT 1
    `,
    [userId],
  ).catch(() => ({ rows: [] as Array<{ email: string; role: string }> }));
}

async function findEmployeeNameByEmail(email: string) {
  return pool.query<{ name: string }>(
    `
      SELECT "name"
      FROM "Employee"
      WHERE LOWER("email") = LOWER($1)
      LIMIT 1
    `,
    [email],
  ).catch(() => ({ rows: [] as Array<{ name: string }> }));
}

export async function resolveSessionUserIdentity(
  userId: number,
  fallback: SessionUserFallback,
): Promise<SessionUserIdentity | null> {
  const userResult = await findPersistedUserById(userId);
  const persistedUser = userResult.rows[0];
  const resolvedEmail = persistedUser?.email?.trim() || fallback.email;
  const role =
    normalizeUserRole(persistedUser?.role) ??
    normalizeUserRole(fallback.role);

  if (!role || !resolvedEmail) {
    return null;
  }

  const employeeResult = await findEmployeeNameByEmail(resolvedEmail);
  const displayName = employeeResult.rows[0]?.name ?? getUserRoleLabel(role);

  return {
    email: resolvedEmail,
    role,
    displayName,
  };
}
