import { createHmac, timingSafeEqual } from "node:crypto";
import { backendEnv } from "@backend/config/env";

const DAY_MS = 1000 * 60 * 60 * 24;

export type ApiSessionPayload = {
  userId: number;
  phone: string;
  /** Старые токены после перехода на телефон */
  email?: string;
  role: string;
  expiresAt: number;
};

function sign(payload: string) {
  return createHmac("sha256", backendEnv.sessionSecret).update(payload).digest("hex");
}

export function createApiSessionToken(payload: Omit<ApiSessionPayload, "expiresAt">) {
  const expiresAt = Date.now() + backendEnv.sessionTtlDays * DAY_MS;
  const encodedPayload = Buffer.from(
    JSON.stringify({
      ...payload,
      expiresAt,
    } satisfies ApiSessionPayload),
  ).toString("base64url");

  return {
    token: `${encodedPayload}.${sign(encodedPayload)}`,
    expiresAt,
  };
}

export function decodeApiSessionToken(value: string): ApiSessionPayload | null {
  const [encodedPayload, signature] = value.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);
  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as ApiSessionPayload & { email?: string };

    if (payload.expiresAt <= Date.now()) {
      return null;
    }

    const phone = payload.phone ?? payload.email ?? "";

    if (!phone) {
      return null;
    }

    return {
      ...payload,
      phone,
    };
  } catch {
    return null;
  }
}

export function getSessionMaxAgeSeconds() {
  return backendEnv.sessionTtlDays * 24 * 60 * 60;
}
