import { createHash } from "node:crypto";
import { pool } from "@backend/shared/db/pool";
import { ValidationError } from "@backend/shared/errors/app-error";
import type { PublicAuthPurpose } from "@backend/modules/public-auth/public-auth.types";

const CODE_TTL_MINUTES = 10;
const RESEND_WINDOW_SECONDS = 55;
const MAX_ATTEMPTS = 5;

type CodeRow = {
  id: number;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
};

function hashCode(phone: string, code: string) {
  return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

export async function assertCanSendCode(phone: string, purpose: PublicAuthPurpose) {
  const result = await pool.query<{ createdAt: Date }>(
    `
      SELECT "createdAt"
      FROM "PhoneVerificationCode"
      WHERE "phone" = $1 AND "purpose" = $2
      ORDER BY "createdAt" DESC
      LIMIT 1
    `,
    [phone, purpose],
  );
  const createdAt = result.rows[0]?.createdAt;

  if (createdAt && Date.now() - createdAt.getTime() < RESEND_WINDOW_SECONDS * 1000) {
    throw new ValidationError("Код уже отправлен. Попробуйте запросить новый чуть позже.");
  }
}

export async function storeCode(phone: string, purpose: PublicAuthPurpose, code: string) {
  await pool.query(
    `
      INSERT INTO "PhoneVerificationCode" ("phone", "purpose", "codeHash", "expiresAt")
      VALUES ($1, $2, $3, NOW() + ($4 || ' minutes')::interval)
    `,
    [phone, purpose, hashCode(phone, code), CODE_TTL_MINUTES],
  );
}

export async function verifyStoredCode(phone: string, purpose: PublicAuthPurpose, code: string) {
  const result = await pool.query<CodeRow>(
    `
      SELECT "id", "codeHash", "attempts", "expiresAt"
      FROM "PhoneVerificationCode"
      WHERE "phone" = $1 AND "purpose" = $2 AND "consumedAt" IS NULL
      ORDER BY "createdAt" DESC
      LIMIT 1
    `,
    [phone, purpose],
  );
  const row = result.rows[0];

  if (!row || row.expiresAt.getTime() <= Date.now()) {
    throw new ValidationError("Код истёк. Запросите новый SMS-код.");
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    throw new ValidationError("Слишком много попыток. Запросите новый SMS-код.");
  }

  if (row.codeHash !== hashCode(phone, code)) {
    await pool.query(
      `UPDATE "PhoneVerificationCode" SET "attempts" = "attempts" + 1 WHERE "id" = $1`,
      [row.id],
    );
    throw new ValidationError("Неверный SMS-код.");
  }

  await pool.query(
    `UPDATE "PhoneVerificationCode" SET "consumedAt" = NOW() WHERE "id" = $1`,
    [row.id],
  );
}
