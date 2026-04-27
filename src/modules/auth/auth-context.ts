import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import type { SessionUser } from "@backend/modules/auth/auth.types";
import { resolveSessionUserIdentity } from "@backend/modules/auth/auth.session.repository";
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
  userId: number;
  email: string;
  role: string;
}): Promise<AuthenticatedApiUser | null> {
  const identity = await resolveSessionUserIdentity(payload.userId, {
    email: payload.email,
    role: payload.role,
  });

  if (!identity) {
    return null;
  }

  const user: SessionUser = {
    id: payload.userId,
    email: identity.email,
    role: identity.role,
    displayName: identity.displayName,
  };

  return {
    ...user,
    permissions: getPermissionsForRole(user.role),
  };
}

export async function resolveAuthUser(request: FastifyRequest) {
  if (request.authUser !== undefined) {
    return request.authUser;
  }

  const token = getRequestToken(request);

  if (!token) {
    request.authUser = null;
    return null;
  }

  const payload = decodeApiSessionToken(token);

  if (!payload) {
    request.authUser = null;
    return null;
  }

  request.authUser = await buildAuthUser(payload);
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
