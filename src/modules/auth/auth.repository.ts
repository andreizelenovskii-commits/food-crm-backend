import { pool } from "@backend/shared/db/pool";
import { ensureRecentDatabaseBackup } from "@backend/shared/db/backup";
import {
  normalizeUserRole,
  type AuthUser,
  type UserRole,
} from "@backend/modules/auth/auth.types";

type UserRow = {
  id: number;
  phone: string;
  password: string;
  role: string;
};

type CreateUserInput = {
  phone: string;
  passwordHash: string;
  role: UserRole;
};

export interface AuthUserRepository {
  findById(userId: number): Promise<AuthUser | null>;
  findByPhone(phone: string): Promise<AuthUser | null>;
  /** Логин: мобильный 7XXXXXXXXXX или legacy email, хранящийся в User.phone. */
  findByLoginKey(login: string): Promise<AuthUser | null>;
  create(input: CreateUserInput): Promise<AuthUser>;
  updatePasswordHash(userId: number, passwordHash: string): Promise<void>;
  updateUser(userId: number, input: { phone: string; role: UserRole; passwordHash?: string }): Promise<void>;
}

function mapRowToAuthUser(row: UserRow): AuthUser {
  const normalizedRole = normalizeUserRole(row.role) ?? "Курьер";

  return {
    id: row.id,
    phone: row.phone,
    passwordHash: row.password,
    role: normalizedRole,
  };
}

class PgAuthUserRepository implements AuthUserRepository {
  async findById(userId: number) {
    const result = await pool.query<UserRow>(
      `
        SELECT "id", "phone", "password", "role"
        FROM "User"
        WHERE "id" = $1
        LIMIT 1
      `,
      [userId],
    );

    const row = result.rows[0];

    return row ? mapRowToAuthUser(row) : null;
  }

  async findByPhone(phone: string) {
    const result = await pool.query<UserRow>(
      `
        SELECT "id", "phone", "password", "role"
        FROM "User"
        WHERE LOWER("phone") = LOWER($1)
        LIMIT 1
      `,
      [phone],
    );

    const row = result.rows[0];

    return row ? mapRowToAuthUser(row) : null;
  }

  async findByLoginKey(login: string) {
    const trimmed = login.trim();
    if (!trimmed) {
      return null;
    }

    if (/^7\d{10}$/.test(trimmed)) {
      const result = await pool.query<UserRow>(
        `
          SELECT "id", "phone", "password", "role"
          FROM "User"
          WHERE "phone" = $1
          LIMIT 1
        `,
        [trimmed],
      );
      const row = result.rows[0];
      return row ? mapRowToAuthUser(row) : null;
    }

    return this.findByPhone(trimmed);
  }

  async create({ phone, passwordHash, role }: CreateUserInput) {
    await ensureRecentDatabaseBackup("auth-user-create");
    const normalizedPhone = phone.trim().toLowerCase();
    const result = await pool.query<UserRow>(
      `
        INSERT INTO "User" ("phone", "password", "role")
        VALUES ($1, $2, $3)
        RETURNING "id", "phone", "password", "role"
      `,
      [normalizedPhone, passwordHash, role],
    );

    return mapRowToAuthUser(result.rows[0]);
  }

  async updatePasswordHash(userId: number, passwordHash: string) {
    await ensureRecentDatabaseBackup("auth-password-update");
    await pool.query(
      `
        UPDATE "User"
        SET "password" = $2, "passwordUpdatedAt" = NOW()
        WHERE "id" = $1
      `,
      [userId, passwordHash],
    );
  }

  async updateUser(
    userId: number,
    input: { phone: string; role: UserRole; passwordHash?: string },
  ) {
    await ensureRecentDatabaseBackup("auth-user-update");
    const normalizedPhone = input.phone.trim().toLowerCase();

    if (input.passwordHash) {
      await pool.query(
        `
          UPDATE "User"
          SET "phone" = $2, "role" = $3, "password" = $4, "passwordUpdatedAt" = NOW()
          WHERE "id" = $1
        `,
        [userId, normalizedPhone, input.role, input.passwordHash],
      );

      return;
    }

    await pool.query(
      `
        UPDATE "User"
        SET "phone" = $2, "role" = $3
        WHERE "id" = $1
      `,
      [userId, normalizedPhone, input.role],
    );
  }
}

export const authUserRepository: AuthUserRepository =
  new PgAuthUserRepository();
