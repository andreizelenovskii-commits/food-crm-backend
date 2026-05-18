import type { FastifyInstance } from "fastify";
import { authenticateUser, changeUserPassword } from "@backend/modules/auth/auth.service";
import { ValidationError } from "@backend/shared/errors/app-error";
import { getPermissionsForRole } from "@backend/modules/access/access-control";
import { authenticateRequest, resolveAuthUser } from "@backend/modules/auth/auth-context";
import {
  createApiSessionToken,
  getApiSessionExpiresAt,
  getSessionMaxAgeSeconds,
} from "@backend/modules/auth/session-token";
import {
  createAuthSession,
  revokeAuthSession,
} from "@backend/modules/auth/auth.session.repository";
import { backendEnv } from "@backend/config/env";
import { getRequestBody, getStringBodyField } from "@backend/lib/request";
import { parseLoginPhone } from "@backend/lib/phone";

function getRequestIp(headers: Record<string, unknown>, fallback: string) {
  const forwardedFor = headers["x-forwarded-for"];
  const realIp = headers["x-real-ip"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0]?.trim() || fallback;
  }

  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim();
  }

  return fallback;
}

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getUserAgent(headers: Record<string, unknown>) {
  const userAgent = headers["user-agent"];
  return typeof userAgent === "string" && userAgent.trim() ? userAgent.trim() : null;
}

function getSessionCookieDomain(request: { hostname: string; headers: Record<string, unknown> }) {
  if (backendEnv.sessionCookieDomain) {
    return backendEnv.sessionCookieDomain;
  }

  const forwardedHost = getHeaderValue(request.headers["x-forwarded-host"] as string | string[] | undefined);
  const host = getHeaderValue(request.headers.host as string | string[] | undefined);
  const normalizedHostname = (forwardedHost || host || request.hostname)
    .split(":")[0]
    ?.toLowerCase() ?? "";

  if (normalizedHostname === "api.crmandromeda.ru") {
    return ".crmandromeda.ru";
  }

  return undefined;
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/api/v1/auth/login", async (request, reply) => {
    const body = getRequestBody(request);
    const password = getStringBodyField(body, "password");
    const loginRaw = getStringBodyField(body, "phone") || getStringBodyField(body, "email");

    if (!loginRaw.trim() || !password) {
      throw new ValidationError("Укажи номер телефона и пароль");
    }

    let login: string;
    try {
      login = parseLoginPhone(loginRaw);
    } catch {
      const legacy = loginRaw.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(legacy)) {
        throw new ValidationError(
          "Введи номер телефона в формате +7 и ещё 10 цифр или корректный email для входа",
        );
      }
      login = legacy;
    }

    const user = await authenticateUser(
      { login, password },
      undefined,
      { ipAddress: getRequestIp(request.headers, request.ip) },
    );
    const expiresAt = getApiSessionExpiresAt();
    const sessionId = await createAuthSession({
      userId: user.id,
      expiresAt: new Date(expiresAt),
      userAgent: getUserAgent(request.headers),
      ip: getRequestIp(request.headers, request.ip),
    });
    const session = createApiSessionToken({
      sessionId,
      userId: user.id,
      phone: user.phone,
      role: user.role,
    }, {
      expiresAt,
    });

    reply.setCookie(backendEnv.sessionCookieName, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      domain: getSessionCookieDomain(request),
      path: "/",
      maxAge: getSessionMaxAgeSeconds(),
    });

    return {
      data: {
        token: session.token,
        expiresAt: new Date(session.expiresAt).toISOString(),
        user: {
          ...user,
          permissions: getPermissionsForRole(user.role),
        },
      },
    };
  });

  app.post("/api/v1/auth/logout", { preHandler: authenticateRequest }, async (request, reply) => {
    const user = await resolveAuthUser(request);

    if (user && request.authSessionId) {
      await revokeAuthSession(request.authSessionId, user.id);
    }

    reply.clearCookie(backendEnv.sessionCookieName, {
      domain: getSessionCookieDomain(request),
      path: "/",
    });
    return { data: { success: true } };
  });

  app.post("/api/v1/auth/change-password", { preHandler: authenticateRequest }, async (request) => {
    const user = await resolveAuthUser(request);

    if (!user) {
      throw new ValidationError("Authentication required");
    }

    const body = getRequestBody(request);
    const currentPassword = getStringBodyField(body, "currentPassword");
    const newPassword = getStringBodyField(body, "newPassword");

    await changeUserPassword(user.id, {
      currentPassword,
      newPassword,
      activeSessionId: request.authSessionId,
    });

    return { data: { success: true } };
  });

  app.get("/api/v1/auth/me", { preHandler: authenticateRequest }, async (request) => ({
    data: await resolveAuthUser(request),
  }));
}
