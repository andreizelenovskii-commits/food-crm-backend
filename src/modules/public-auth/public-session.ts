import { createHmac, timingSafeEqual } from "node:crypto";
import { backendEnv } from "@backend/config/env";
import type { PublicClientSession } from "@backend/modules/public-auth/public-auth.types";

const DAY_MS = 1000 * 60 * 60 * 24;

function sign(payload: string) {
  return createHmac("sha256", backendEnv.sessionSecret)
    .update(`client:${payload}`)
    .digest("hex");
}

export function createPublicClientSession(payload: Omit<PublicClientSession, "expiresAt">) {
  const expiresAt = Date.now() + backendEnv.sessionTtlDays * DAY_MS;
  const encodedPayload = Buffer.from(JSON.stringify({ ...payload, expiresAt })).toString("base64url");

  return {
    token: `${encodedPayload}.${sign(encodedPayload)}`,
    expiresAt,
  };
}

export function decodePublicClientSession(value: string | undefined): PublicClientSession | null {
  if (!value) {
    return null;
  }

  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(sign(encodedPayload), "hex");
  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as PublicClientSession;

    if (!payload.phone || payload.expiresAt <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
