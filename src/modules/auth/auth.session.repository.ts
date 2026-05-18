import { randomUUID } from "node:crypto";
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

type AuthSessionRow = {
  sessionId: string;
  userId: number;
  expiresAt: Date;
  revokedAt: Date | null;
};

type CreateAuthSessionInput = {
  userId: number;
  expiresAt: Date;
  userAgent: string | null;
  ip: string | null;
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

export async function createAuthSession(input: CreateAuthSessionInput) {
  const sessionId = randomUUID();

  await pool.query(
    `
      INSERT INTO "sessions" ("sessionId", "userId", "expiresAt", "userAgent", "ip")
      VALUES ($1, $2, $3, $4, $5)
    `,
    [sessionId, input.userId, input.expiresAt, input.userAgent, input.ip],
  );

  return sessionId;
}

export async function findActiveAuthSession(sessionId: string, userId: number) {
  const result = await pool.query<AuthSessionRow>(
    `
      SELECT "sessionId", "userId", "expiresAt", "revokedAt"
      FROM "sessions"
      WHERE "sessionId" = $1
        AND "userId" = $2
        AND "revokedAt" IS NULL
        AND "expiresAt" > NOW()
      LIMIT 1
    `,
    [sessionId, userId],
  ).catch(() => ({ rows: [] as AuthSessionRow[] }));

  return result.rows[0] ?? null;
}

export async function revokeAuthSession(sessionId: string, userId: number) {
  await pool.query(
    `
      UPDATE "sessions"
      SET "revokedAt" = NOW()
      WHERE "sessionId" = $1
        AND "userId" = $2
        AND "revokedAt" IS NULL
    `,
    [sessionId, userId],
  );
}

export async function revokeOtherAuthSessions(userId: number, activeSessionId: string | null) {
  await pool.query(
    `
      UPDATE "sessions"
      SET "revokedAt" = NOW()
      WHERE "userId" = $1
        AND "revokedAt" IS NULL
        AND ($2::text IS NULL OR "sessionId" <> $2)
    `,
    [userId, activeSessionId],
  );
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
