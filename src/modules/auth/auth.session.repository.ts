import {
  getUserRoleLabel,
  normalizeUserRole,
  type UserRole,
} from "@backend/modules/auth/auth.types";
import { pool } from "@backend/shared/db/pool";

type SessionUserIdentity = {
  phone: string;
  role: UserRole;
  displayName: string;
};

type SessionUserFallback = {
  phone: string;
  role: string;
};

async function findPersistedUserById(userId: number) {
  return pool.query<{ phone: string; role: string }>(
    `
      SELECT "phone", "role"
      FROM "User"
      WHERE "id" = $1
      LIMIT 1
    `,
    [userId],
  ).catch(() => ({ rows: [] as Array<{ phone: string; role: string }> }));
}

async function findEmployeeDisplayName(loginId: string) {
  if (/^7\d{10}$/.test(loginId)) {
    return pool.query<{ name: string }>(
      `
        SELECT "name"
        FROM "Employee"
        WHERE regexp_replace(COALESCE("phone", ''), '\\D', '', 'g') = $1
        LIMIT 1
      `,
      [loginId],
    ).catch(() => ({ rows: [] as Array<{ name: string }> }));
  }

  return pool.query<{ name: string }>(
    `
      SELECT "name"
      FROM "Employee"
      WHERE LOWER(COALESCE("email", '')) = LOWER($1)
      LIMIT 1
    `,
    [loginId],
  ).catch(() => ({ rows: [] as Array<{ name: string }> }));
}

export async function resolveSessionUserIdentity(
  userId: number,
  fallback: SessionUserFallback,
): Promise<SessionUserIdentity | null> {
  const userResult = await findPersistedUserById(userId);
  const persistedUser = userResult.rows[0];
  const resolvedPhone = persistedUser?.phone?.trim() || fallback.phone;
  const role =
    normalizeUserRole(persistedUser?.role) ??
    normalizeUserRole(fallback.role);

  if (!role || !resolvedPhone) {
    return null;
  }

  const employeeResult = await findEmployeeDisplayName(resolvedPhone);
  const displayName = employeeResult.rows[0]?.name ?? getUserRoleLabel(role);

  return {
    phone: resolvedPhone,
    role,
    displayName,
  };
}
