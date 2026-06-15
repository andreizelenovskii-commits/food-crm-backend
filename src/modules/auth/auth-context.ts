import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import type { SessionUser } from "@backend/modules/auth/auth.types";
import {
  findActiveAuthSession,
  resolveSessionUserIdentity,
} from "@backend/modules/auth/auth.session.repository";
import {
  getPermissionsForRole,
  hasApiPermission,
  type AccessPermission,
  type AuthenticatedApiUser,
} from "@backend/modules/access/access-control";
import { decodeApiSessionToken } from "@backend/modules/auth/session-token";
import { AuthenticationError } from "@backend/shared/errors/app-error";
import { AuthorizationError } from "@backend/lib/http-errors";

declare module "fastify" {
  interface FastifyRequest {
    authUser: AuthenticatedApiUser | null;
    authSessionId: string | null;
  }
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

  const session = await findActiveAuthSession(payload.sessionId, payload.userId);

  if (!session) {
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
    return null;
  }

  const payload = decodeApiSessionToken(token);

  if (!payload) {
    request.authUser = null;
    request.authSessionId = null;
    return null;
  }

  request.authUser = await buildAuthUser(payload);
  request.authSessionId = request.authUser ? payload.sessionId : null;
  return request.authUser;
}

export const authenticateRequest: preHandlerHookHandler = async (request) => {
  const user = await resolveAuthUser(request);

  if (!user) {
    throw new AuthenticationError("Authentication required");
  }
};

export function requirePermission(permission: AccessPermission): preHandlerHookHandler {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const user = await resolveAuthUser(request);

    if (!user) {
      throw new AuthenticationError("Authentication required");
    }

    if (!hasApiPermission(user, permission)) {
      throw new AuthorizationError("Access denied");
    }
  };
}
