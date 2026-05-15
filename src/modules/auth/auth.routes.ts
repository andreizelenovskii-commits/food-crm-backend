import type { FastifyInstance } from "fastify";
import { authenticateUser } from "@backend/modules/auth/auth.service";
import { ValidationError } from "@backend/shared/errors/app-error";
import { getPermissionsForRole } from "@backend/modules/access/access-control";
import { authenticateRequest, resolveAuthUser } from "@backend/modules/auth/auth-context";
import { createApiSessionToken, getSessionMaxAgeSeconds } from "@backend/modules/auth/session-token";
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
    const session = createApiSessionToken({
      userId: user.id,
      phone: user.phone,
      role: user.role,
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

  app.post("/api/v1/auth/logout", { preHandler: authenticateRequest }, async (_request, reply) => {
    reply.clearCookie(backendEnv.sessionCookieName, {
      domain: getSessionCookieDomain(_request),
      path: "/",
    });
    return { data: { success: true } };
  });

  app.get("/api/v1/auth/me", { preHandler: authenticateRequest }, async (request) => ({
    data: await resolveAuthUser(request),
  }));
}
