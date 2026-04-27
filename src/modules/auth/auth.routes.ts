import type { FastifyInstance } from "fastify";
import { authenticateUser } from "@backend/modules/auth/auth.service";
import { ValidationError } from "@backend/shared/errors/app-error";
import { getPermissionsForRole } from "@backend/modules/access/access-control";
import { authenticateRequest, resolveAuthUser } from "@backend/modules/auth/auth-context";
import { createApiSessionToken, getSessionMaxAgeSeconds } from "@backend/modules/auth/session-token";
import { backendEnv } from "@backend/config/env";
import { getRequestBody, getStringBodyField } from "@backend/lib/request";

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

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/api/v1/auth/login", async (request, reply) => {
    const body = getRequestBody(request);
    const email = getStringBodyField(body, "email");
    const password = getStringBodyField(body, "password");

    if (!email || !password) {
      throw new ValidationError("Укажи email и пароль");
    }

    const user = await authenticateUser(
      { email, password },
      undefined,
      { ipAddress: getRequestIp(request.headers, request.ip) },
    );
    const session = createApiSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    reply.setCookie(backendEnv.sessionCookieName, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "@backend/",
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
    reply.clearCookie(backendEnv.sessionCookieName, { path: "@backend/" });
    return { data: { success: true } };
  });

  app.get("/api/v1/auth/me", { preHandler: authenticateRequest }, async (request) => ({
    data: await resolveAuthUser(request),
  }));
}
