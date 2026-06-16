import {
  normalizeUserRole,
  type SessionUser,
  type UserRole,
} from "@backend/modules/auth/auth.types";
import { pool } from "@backend/shared/db/pool";

export const ACCESS_PERMISSIONS = [
  "view_dashboard",
  "view_orders",
  "manage_orders",
  "view_catalog",
  "manage_catalog",
  "view_inventory",
  "manage_inventory",
  "view_settings",
  "manage_settings",
  "view_clients",
  "manage_clients",
  "view_employees",
  "manage_employees",
] as const;

export type AccessPermission = (typeof ACCESS_PERMISSIONS)[number];

export type RoleModel = {
  role: UserRole;
  label: string;
  permissions: AccessPermission[];
};

export const ROLE_MODELS: Record<UserRole, RoleModel> = {
  admin: {
    role: "admin",
    label: "Администратор",
    permissions: [...ACCESS_PERMISSIONS],
  },
  "Администратор": {
    role: "Администратор",
    label: "Администратор",
    permissions: [...ACCESS_PERMISSIONS],
  },
  "Шеф повар": {
    role: "Шеф повар",
    label: "Шеф повар",
    permissions: [...ACCESS_PERMISSIONS],
  },
  "Управляющий": {
    role: "Управляющий",
    label: "Управляющий",
    permissions: [...ACCESS_PERMISSIONS],
  },
  "Старший курьер": {
    role: "Старший курьер",
    label: "Старший курьер",
    permissions: [...ACCESS_PERMISSIONS],
  },
  "Диспетчер": {
    role: "Диспетчер",
    label: "Диспетчер",
    permissions: [
      "view_dashboard",
      "view_orders",
      "manage_orders",
      "view_catalog",
      "view_clients",
    ],
  },
  "Повар": {
    role: "Повар",
    label: "Повар",
    permissions: ["view_dashboard", "view_orders"],
  },
  "Курьер": {
    role: "Курьер",
    label: "Курьер",
    permissions: ["view_dashboard", "view_orders"],
  },
};

export type AuthenticatedApiUser = SessionUser & {
  permissions: AccessPermission[];
};

const ACCESS_PERMISSION_SET = new Set<string>(ACCESS_PERMISSIONS);
const ROLE_PERMISSIONS_CACHE_TTL_MS = 30_000;

const rolePermissionsCache = new Map<
  UserRole,
  { expiresAt: number; permissions: AccessPermission[] }
>();

function normalizePermissions(values: unknown[]) {
  const permissions = values.filter((value): value is AccessPermission =>
    typeof value === "string" && ACCESS_PERMISSION_SET.has(value),
  );

  return Array.from(new Set(permissions));
}

export function getRoleModel(role: unknown) {
  const normalizedRole = normalizeUserRole(role);

  if (!normalizedRole) {
    return null;
  }

  return ROLE_MODELS[normalizedRole];
}

export function getDefaultPermissionsForRole(role: unknown) {
  return getRoleModel(role)?.permissions ?? [];
}

export async function getPermissionsForRole(role: unknown) {
  const normalizedRole = normalizeUserRole(role);

  if (!normalizedRole) {
    return [];
  }

  const cached = rolePermissionsCache.get(normalizedRole);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.permissions;
  }

  const result = await pool.query<{ permission: string }>(
    `
      SELECT "permission"
      FROM "RolePermission"
      WHERE "role" = $1
      ORDER BY "permission" ASC
    `,
    [normalizedRole],
  ).catch(() => ({ rows: [] as Array<{ permission: string }> }));

  const permissions = result.rows.length === 0
    ? getDefaultPermissionsForRole(normalizedRole)
    : normalizePermissions(result.rows.map((row) => row.permission));

  rolePermissionsCache.set(normalizedRole, {
    expiresAt: Date.now() + ROLE_PERMISSIONS_CACHE_TTL_MS,
    permissions,
  });

  return permissions;
}

export async function getRoleModels() {
  return Promise.all(
    Object.values(ROLE_MODELS).map(async (model) => ({
      ...model,
      permissions: await getPermissionsForRole(model.role),
    })),
  );
}

export async function replaceRolePermissions(role: unknown, permissions: unknown[]) {
  const normalizedRole = normalizeUserRole(role);

  if (!normalizedRole) {
    return null;
  }

  const normalizedPermissions = normalizePermissions(permissions);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM "RolePermission" WHERE "role" = $1`, [normalizedRole]);

    for (const permission of normalizedPermissions) {
      await client.query(
        `
          INSERT INTO "RolePermission" ("role", "permission")
          VALUES ($1, $2)
          ON CONFLICT ("role", "permission") DO NOTHING
        `,
        [normalizedRole, permission],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  rolePermissionsCache.delete(normalizedRole);

  return {
    role: normalizedRole,
    permissions: normalizedPermissions,
  };
}

export function hasApiPermission(
  userOrRole: AuthenticatedApiUser | UserRole,
  permission: AccessPermission,
) {
  if (typeof userOrRole !== "string") {
    return userOrRole.permissions.includes(permission);
  }

  return getDefaultPermissionsForRole(userOrRole).includes(permission);
}
