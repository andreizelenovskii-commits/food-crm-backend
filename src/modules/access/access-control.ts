import {
  normalizeUserRole,
  type SessionUser,
  type UserRole,
} from "@backend/modules/auth/auth.types";

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
    label: "Управляющий",
    permissions: [...ACCESS_PERMISSIONS],
  },
  "Управляющий": {
    role: "Управляющий",
    label: "Управляющий",
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

export function getRoleModel(role: unknown) {
  const normalizedRole = normalizeUserRole(role);

  if (!normalizedRole) {
    return null;
  }

  return ROLE_MODELS[normalizedRole];
}

export function getPermissionsForRole(role: unknown) {
  return getRoleModel(role)?.permissions ?? [];
}

export function hasApiPermission(
  userOrRole: AuthenticatedApiUser | UserRole,
  permission: AccessPermission,
) {
  const rawRole = typeof userOrRole === "string" ? userOrRole : userOrRole.role;

  return getPermissionsForRole(rawRole).includes(permission);
}
