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

type AuthenticateDependencies = {
  users: AuthUserRepository;
};

const defaultDependencies: AuthenticateDependencies = {
  users: authUserRepository,
};

export async function authenticateUser(
  input: LoginInput,
  dependencies: AuthenticateDependencies = defaultDependencies,
  requestMeta?: {
    ipAddress?: string;
  },
): Promise<SessionUser> {
  if (!input.email || !input.password) {
    throw new ValidationError("Некорректные данные для входа");
  }

  const ipAddress = requestMeta?.ipAddress?.trim() || "unknown";
  assertCanAttemptLogin(input.email, ipAddress);

  const user = await dependencies.users.findByEmail(input.email);
  const passwordVerification = user
    ? verifyPassword(input.password, user.passwordHash)
    : { valid: false, needsRehash: false };

  if (!user || !passwordVerification.valid) {
    recordFailedLoginAttempt(input.email, ipAddress);
    throw new AuthenticationError("Неверный email или пароль");
  }

  clearFailedLoginAttempts(input.email, ipAddress);

  if (passwordVerification.needsRehash) {
    await dependencies.users.updatePasswordHash(user.id, hashPassword(input.password));
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
  };
}
