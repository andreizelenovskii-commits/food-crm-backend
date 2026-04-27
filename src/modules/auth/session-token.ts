import { createHmac, timingSafeEqual } from "node:crypto";
import { backendEnv } from "@backend/config/env";

const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

export type ApiSessionPayload = {
  userId: number;
  email: string;
  role: string;
  expiresAt: number;
};

function sign(payload: string) {
  return createHmac("sha256", backendEnv.sessionSecret).update(payload).digest("hex");
}

export function createApiSessionToken(payload: Omit<ApiSessionPayload, "expiresAt">) {
  const expiresAt = Date.now() + SESSION_TTL_MS;
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
    ) as ApiSessionPayload;

    if (payload.expiresAt <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getSessionMaxAgeSeconds() {
  return Math.floor(SESSION_TTL_MS / 1000);
}
