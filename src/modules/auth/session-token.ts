import { createHmac, timingSafeEqual } from "node:crypto";
import { backendEnv } from "@backend/config/env";

const DAY_MS = 1000 * 60 * 60 * 24;

export type ApiSessionPayload = {
  sessionId: string;
  userId: number;
  phone: string;
  /** Старые токены после перехода на телефон */
  email?: string;
  role: string;
  issuedAt: number;
  expiresAt: number;
};

export type DecodeApiSessionTokenResult =
  | { ok: true; payload: ApiSessionPayload }
  | { ok: false; reason: "invalid" | "expired" };

function sign(payload: string) {
  return createHmac("sha256", backendEnv.sessionSecret).update(payload).digest("hex");
}

export function getApiSessionExpiresAt() {
  return Date.now() + backendEnv.sessionTtlDays * DAY_MS;
}

export function createApiSessionToken(
  payload: Omit<ApiSessionPayload, "expiresAt" | "issuedAt">,
  options: { expiresAt?: number } = {},
) {
  const issuedAt = Date.now();
  const expiresAt = options.expiresAt ?? getApiSessionExpiresAt();
  const encodedPayload = Buffer.from(
    JSON.stringify({
      ...payload,
      issuedAt,
      expiresAt,
    } satisfies ApiSessionPayload),
  ).toString("base64url");

  return {
    token: `${encodedPayload}.${sign(encodedPayload)}`,
    expiresAt,
  };
}

export function decodeApiSessionTokenDetailed(value: string): DecodeApiSessionTokenResult {
  const [encodedPayload, signature] = value.split(".");

  if (!encodedPayload || !signature) {
    return { ok: false, reason: "invalid" };
  }

  const expectedSignature = sign(encodedPayload);
  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (signatureBuffer.length !== expectedBuffer.length) {
    return { ok: false, reason: "invalid" };
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as ApiSessionPayload & { email?: string };

    if (payload.expiresAt <= Date.now()) {
      return { ok: false, reason: "expired" };
    }

    const phone = payload.phone ?? payload.email ?? "";

    if (!phone || typeof payload.sessionId !== "string" || !payload.sessionId) {
      return { ok: false, reason: "invalid" };
    }

    return {
      ok: true,
      payload: {
        ...payload,
        phone,
      },
    };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

export function decodeApiSessionToken(value: string): ApiSessionPayload | null {
  const result = decodeApiSessionTokenDetailed(value);

  return result.ok ? result.payload : null;
}

export function getSessionMaxAgeSeconds() {
  return backendEnv.sessionTtlDays * 24 * 60 * 60;
}
