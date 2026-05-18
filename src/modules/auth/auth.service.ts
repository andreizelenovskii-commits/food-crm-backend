import {
  AuthenticationError,
  ValidationError,
} from "@backend/shared/errors/app-error";
import { authUserRepository, type AuthUserRepository } from "@backend/modules/auth/auth.repository";
import {
  clearFailedLoginAttempts,
  assertCanAttemptLogin,
  recordFailedLoginAttempt,
} from "@backend/modules/auth/auth.rate-limit";
import { hashPassword, verifyPassword } from "@backend/modules/auth/auth.password";
import type { LoginInput, SessionUser } from "@backend/modules/auth/auth.types";
import { revokeOtherAuthSessions } from "@backend/modules/auth/auth.session.repository";

type AuthenticateDependencies = {
  users: AuthUserRepository;
  sessions: {
    revokeOther: (userId: number, activeSessionId: string | null) => Promise<void>;
  };
};

const defaultDependencies: AuthenticateDependencies = {
  users: authUserRepository,
  sessions: {
    revokeOther: revokeOtherAuthSessions,
  },
};

export async function authenticateUser(
  input: LoginInput,
  dependencies: AuthenticateDependencies = defaultDependencies,
  requestMeta?: {
    ipAddress?: string;
  },
): Promise<SessionUser> {
  if (!input.login || !input.password) {
    throw new ValidationError("Некорректные данные для входа");
  }

  const ipAddress = requestMeta?.ipAddress?.trim() || "unknown";
  await assertCanAttemptLogin(input.login, ipAddress);

  const user = await dependencies.users.findByLoginKey(input.login);
  const passwordVerification = user
    ? verifyPassword(input.password, user.passwordHash)
    : { valid: false, needsRehash: false };

  if (!user || !passwordVerification.valid) {
    await recordFailedLoginAttempt(input.login, ipAddress);
    throw new AuthenticationError("Неверный телефон или пароль");
  }

  await clearFailedLoginAttempts(input.login, ipAddress);

  if (passwordVerification.needsRehash) {
    await dependencies.users.updatePasswordHash(user.id, hashPassword(input.password));
  }

  return {
    id: user.id,
    phone: user.phone,
    role: user.role,
  };
}

export async function changeUserPassword(
  userId: number,
  input: {
    currentPassword: string;
    newPassword: string;
    activeSessionId?: string | null;
  },
  dependencies: AuthenticateDependencies = defaultDependencies,
) {
  if (!input.currentPassword || !input.newPassword) {
    throw new ValidationError("Укажи текущий и новый пароль");
  }

  if (input.currentPassword === input.newPassword) {
    throw new ValidationError("Новый пароль должен отличаться от текущего");
  }

  const user = await dependencies.users.findById(userId);

  if (!user) {
    throw new AuthenticationError("Authentication required");
  }

  const passwordVerification = verifyPassword(input.currentPassword, user.passwordHash);

  if (!passwordVerification.valid) {
    throw new AuthenticationError("Текущий пароль указан неверно");
  }

  let newPasswordHash: string;
  try {
    newPasswordHash = hashPassword(input.newPassword, { validateStrength: true });
  } catch (error) {
    if (error instanceof Error) {
      throw new ValidationError(error.message);
    }
    throw error;
  }

  await dependencies.users.updatePasswordHash(user.id, newPasswordHash);
  await dependencies.sessions.revokeOther(user.id, input.activeSessionId ?? null);
}
