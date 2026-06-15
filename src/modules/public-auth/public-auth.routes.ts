import type { FastifyInstance, FastifyReply } from "fastify";
import { backendEnv } from "@backend/config/env";
import { getRequestBody } from "@backend/lib/request";
import { ValidationError } from "@backend/shared/errors/app-error";
import {
  createPublicClientSession,
  decodePublicClientSession,
} from "@backend/modules/public-auth/public-session";
import {
  findPublicClientByPhone,
  parseCodeInput,
  parsePhoneInput,
  parsePublicProfileInput,
  parseRegisterInput,
  registerPublicClient,
  requestPublicCode,
  toPublicClientProfile,
  updatePublicClientProfile,
  verifyPublicCode,
} from "@backend/modules/public-auth/public-auth.service";

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getSessionCookieDomain(request: { hostname: string; headers: Record<string, unknown> }) {
  if (backendEnv.sessionCookieDomain) {
    return backendEnv.sessionCookieDomain;
  }

  const forwardedHost = getHeaderValue(request.headers["x-forwarded-host"] as string | string[] | undefined);
  const host = getHeaderValue(request.headers.host as string | string[] | undefined);
  const hostname = (forwardedHost || host || request.hostname).split(":")[0]?.toLowerCase() ?? "";

  return hostname === "api.crmandromeda.ru" ? ".crmandromeda.ru" : undefined;
}

function setClientCookie(
  request: { hostname: string; headers: Record<string, unknown> },
  reply: FastifyReply,
  client: { id: number; phone: string },
) {
  const session = createPublicClientSession({
    phone: client.phone,
  });

  reply.setCookie(backendEnv.clientSessionCookieName, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    domain: getSessionCookieDomain(request),
    path: "/",
    maxAge: backendEnv.sessionTtlDays * 24 * 60 * 60,
    expires: new Date(session.expiresAt),
  });
}

export async function registerPublicAuthRoutes(app: FastifyInstance) {
  app.post("/api/v1/public-auth/register/request-code", async (request) => {
    const input = parseRegisterInput(getRequestBody(request));
    await requestPublicCode(input.phone, "register");
    return { data: { success: true } };
  });

  app.post("/api/v1/public-auth/register/verify", async (request, reply) => {
    const body = getRequestBody(request);
    const input = parseRegisterInput(body);
    await verifyPublicCode(input.phone, "register", parseCodeInput(body));
    const client = await registerPublicClient(input);
    setClientCookie(request, reply, client);
    return { data: toPublicClientProfile(client) };
  });

  app.post("/api/v1/public-auth/login/request-code", async (request) => {
    const phone = parsePhoneInput(getRequestBody(request));
    const client = await findPublicClientByPhone(phone);

    if (!client) {
      throw new ValidationError("Клиент с таким телефоном не найден. Зарегистрируйтесь на сайте.");
    }

    await requestPublicCode(phone, "login");
    return { data: { success: true } };
  });

  app.post("/api/v1/public-auth/login/verify", async (request, reply) => {
    const body = getRequestBody(request);
    const phone = parsePhoneInput(body);
    await verifyPublicCode(phone, "login", parseCodeInput(body));
    const client = await findPublicClientByPhone(phone);

    if (!client) {
      throw new ValidationError("Клиент с таким телефоном не найден. Зарегистрируйтесь на сайте.");
    }

    setClientCookie(request, reply, client);
    return { data: toPublicClientProfile(client) };
  });

  app.post("/api/v1/public-auth/logout", async (request, reply) => {
    reply.clearCookie(backendEnv.clientSessionCookieName, {
      domain: getSessionCookieDomain(request),
      path: "/",
    });
    return { data: { success: true } };
  });

  app.get("/api/v1/public-auth/me", async (request) => {
    const session = decodePublicClientSession(request.cookies[backendEnv.clientSessionCookieName]);
    const client = session ? await findPublicClientByPhone(session.phone) : null;
    return { data: client ? toPublicClientProfile(client) : null };
  });

  app.patch("/api/v1/public-auth/me", async (request) => {
    const session = decodePublicClientSession(request.cookies[backendEnv.clientSessionCookieName]);

    if (!session) {
      throw new ValidationError("Войдите в профиль");
    }

    const client = await updatePublicClientProfile(
      session.phone,
      parsePublicProfileInput(getRequestBody(request)),
    );

    return { data: toPublicClientProfile(client) };
  });
}
