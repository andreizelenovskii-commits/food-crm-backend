export const USER_ROLES = [
  "admin",
  "Управляющий",
  "Диспетчер",
  "Повар",
  "Курьер",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: "Управляющий",
  "Управляющий": "Управляющий",
  "Диспетчер": "Диспетчер",
  "Повар": "Повар",
  "Курьер": "Курьер",
};

const LEGACY_USER_ROLE_ALIASES: Record<string, UserRole> = {
  "Менеджер": "Управляющий",
};

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}

export function normalizeUserRole(value: unknown): UserRole | null {
  if (isUserRole(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  return LEGACY_USER_ROLE_ALIASES[value] ?? null;
}

export function getUserRoleLabel(value: unknown) {
  const normalizedRole = normalizeUserRole(value);
  return normalizedRole ? USER_ROLE_LABELS[normalizedRole] : String(value ?? "Неизвестная роль");
}

/** Логин: 11 цифр 7XXXXXXXXXX или legacy email. */
export type LoginInput = {
  login: string;
  password: string;
};

export type AuthUser = {
  id: number;
  email: string;
  passwordHash: string;
  role: UserRole;
};

/** Поле `phone` — идентификатор входа (номер 7… или legacy email), значение колонки User.email в БД. */
export type SessionUser = {
  id: number;
  phone: string;
  role: UserRole;
  displayName?: string | null;
};
