import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import type { SessionUser } from "@backend/modules/auth/auth.types";
import {
  findAuthSessionStatus,
  resolveSessionUserIdentity,
} from "@backend/modules/auth/auth.session.repository";
import {
  getPermissionsForRole,
  hasApiPermission,
  type AccessPermission,
  type AuthenticatedApiUser,
} from "@backend/modules/access/access-control";
import { decodeApiSessionTokenDetailed } from "@backend/modules/auth/session-token";
import { AuthenticationError } from "@backend/shared/errors/app-error";
import { AuthorizationError } from "@backend/lib/http-errors";

declare module "fastify" {
  interface FastifyRequest {
    authUser: AuthenticatedApiUser | null;
    authSessionId: string | null;
    authFailureReason: AuthFailureReason | null;
  }
}

export type AuthFailureReason =
  | "missing_session"
  | "invalid_session"
  | "expired_session"
  | "revoked_session"
  | "other_device"
  | "password_changed"
  | "user_not_found";

export function authFailureMessage(reason: AuthFailureReason | null) {
  if (reason === "expired_session") {
    return "Сессия истекла. Войдите снова.";
  }

  if (reason === "other_device") {
    return "Выполнен вход с другого устройства. Для безопасности текущая сессия завершена.";
  }

  if (reason === "password_changed") {
    return "Пароль был изменён. Войди снова с новым паролем.";
  }

  if (reason === "revoked_session") {
    return "Сессия завершена. Войдите снова.";
  }

  if (reason === "invalid_session") {
    return "Сессия повреждена или cookie устарела. Войдите снова.";
  }

  if (reason === "user_not_found") {
    return "Аккаунт больше не найден или доступ был изменён. Войдите снова.";
  }

  return "Требуется вход в CRM.";
}

function getBearerToken(request: FastifyRequest) {
  const authorization = request.headers.authorization?.trim();

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim() || null;
}

function getRequestToken(request: FastifyRequest) {
  return (
    getBearerToken(request) ||
    request.cookies.food_crm_api_session ||
    request.cookies[request.server.sessionCookieName]
  );
}

async function buildAuthUser(payload: {
  sessionId?: string;
  userId: number;
  phone: string;
  email?: string;
  role: string;
  issuedAt?: number;
}): Promise<AuthenticatedApiUser | null> {
  const loginId = payload.phone || payload.email || "";

  if (!payload.sessionId) {
    return null;
  }

  const sessionStatus = await findAuthSessionStatus(payload.sessionId, payload.userId);

  if (sessionStatus.status !== "active") {
    return null;
  }

  const identity = await resolveSessionUserIdentity(payload.userId, {
    phone: loginId,
    role: payload.role,
  });

  if (!identity) {
    return null;
  }

  const user: SessionUser = {
    id: payload.userId,
    phone: identity.phone,
    role: identity.role,
    displayName: identity.displayName,
  };

  return {
    ...user,
    permissions: await getPermissionsForRole(user.role),
  };
}

export async function resolveAuthUser(request: FastifyRequest) {
  if (request.authUser !== undefined) {
    return request.authUser;
  }

  const token = getRequestToken(request);

  if (!token) {
    request.authUser = null;
    request.authSessionId = null;
    request.authFailureReason = "missing_session";
    return null;
  }

  const decoded = decodeApiSessionTokenDetailed(token);

  if (!decoded.ok) {
    request.authUser = null;
    request.authSessionId = null;
    request.authFailureReason = decoded.reason === "expired" ? "expired_session" : "invalid_session";
    return null;
  }

  const payload = decoded.payload;

  const sessionStatus = await findAuthSessionStatus(payload.sessionId, payload.userId);

  if (sessionStatus.status !== "active") {
    request.authUser = null;
    request.authSessionId = null;
    request.authFailureReason =
      sessionStatus.status === "expired"
        ? "expired_session"
        : sessionStatus.status === "revoked" && sessionStatus.session.revokedReason === "other_device"
          ? "other_device"
          : sessionStatus.status === "revoked" && sessionStatus.session.revokedReason === "password_changed"
            ? "password_changed"
          : sessionStatus.status === "revoked"
            ? "revoked_session"
            : "invalid_session";
    return null;
  }

  request.authUser = await buildAuthUser(payload);
  request.authSessionId = request.authUser ? payload.sessionId : null;
  request.authFailureReason = request.authUser ? null : "user_not_found";
  return request.authUser;
}

export const authenticateRequest: preHandlerHookHandler = async (request) => {
  const user = await resolveAuthUser(request);

  if (!user) {
    throw new AuthenticationError(authFailureMessage(request.authFailureReason));
  }
};

export function requirePermission(permission: AccessPermission): preHandlerHookHandler {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const user = await resolveAuthUser(request);

    if (!user) {
      throw new AuthenticationError(authFailureMessage(request.authFailureReason));
    }

    if (!hasApiPermission(user, permission)) {
      throw new AuthorizationError("Access denied");
    }
  };
}
