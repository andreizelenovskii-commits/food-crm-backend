import type { FastifyRequest } from "fastify";
import { pool } from "@backend/shared/db/pool";

type AuditValue = unknown;

type AuditLogInput = {
  request: FastifyRequest;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  before?: AuditValue;
  after?: AuditValue;
};

function getRequestIp(request: FastifyRequest) {
  const forwardedFor = request.headers["x-forwarded-for"];
  const realIp = request.headers["x-real-ip"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0]?.trim() || request.ip;
  }

  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim();
  }

  return request.ip;
}

function toJsonValue(value: AuditValue) {
  return value === undefined ? null : JSON.stringify(value);
}

export async function writeAuditLog({
  request,
  action,
  entityType,
  entityId,
  before,
  after,
}: AuditLogInput) {
  await pool.query(
    `
      INSERT INTO "audit_log" (
        "actorUserId",
        "action",
        "entityType",
        "entityId",
        "before",
        "after",
        "ip"
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
    `,
    [
      request.authUser?.id ?? null,
      action,
      entityType,
      entityId === undefined || entityId === null ? null : String(entityId),
      toJsonValue(before),
      toJsonValue(after),
      getRequestIp(request),
    ],
  );
}
