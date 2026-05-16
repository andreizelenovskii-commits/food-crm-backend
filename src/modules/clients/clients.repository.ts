import { pool } from "@backend/shared/db/pool";
import { ensureRecentDatabaseBackup } from "@backend/shared/db/backup";
import { ValidationError } from "@backend/shared/errors/app-error";
import { normalizeRussianPhoneForStorage } from "@backend/shared/lib/phone";
import type { Client } from "@backend/modules/clients/clients.types";
import type {
  CreateClientInput,
  UpdateClientInput,
} from "@backend/modules/clients/clients.validation";

type ClientRow = {
  id: number;
  name: string;
  type: Client["type"];
  email: string | null;
  phone: string;
  birthDate: Date | null;
  address: string | null;
  notes: string | null;
  loyaltyLevelOverride: Client["loyaltyLevelOverride"];
  ordersCount?: string;
  totalSpentCents?: string;
  createdAt: Date;
};

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mapRowToClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    email: row.email,
    phone: row.phone,
    birthDate: row.birthDate ? formatDateOnly(row.birthDate) : null,
    address: row.address,
    notes: row.notes,
    loyaltyLevelOverride: row.loyaltyLevelOverride,
    ordersCount: Number(row.ordersCount ?? 0),
    totalSpentCents: Number(row.totalSpentCents ?? 0),
    loyaltyLevel: null,
    loyaltyNextLevel: null,
    loyaltyAmountToNextLevelCents: 0,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getAllClients(): Promise<Client[]> {
  const result = await pool.query<ClientRow>(
    `
      SELECT
        c."id",
        c."name",
        c."type",
        c."email",
        c."phone",
        c."birthDate",
        c."address",
        c."notes",
        c."loyaltyLevelOverride",
        c."createdAt",
        COUNT(o."id") AS "ordersCount",
        COALESCE(SUM(o."totalCents"), 0) AS "totalSpentCents"
      FROM "Client" c
      LEFT JOIN "Order" o ON o."clientId" = c."id"
      GROUP BY
        c."id",
        c."name",
        c."type",
        c."email",
        c."phone",
        c."birthDate",
        c."address",
        c."notes",
        c."loyaltyLevelOverride",
        c."createdAt"
      ORDER BY c."createdAt" DESC
    `,
  );

  return result.rows.map(mapRowToClient);
}

export async function getClientById(clientId: number): Promise<Client | null> {
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return null;
  }

  const result = await pool.query<ClientRow>(
    `
      SELECT
        c."id",
        c."name",
        c."type",
        c."email",
        c."phone",
        c."birthDate",
        c."address",
        c."notes",
        c."loyaltyLevelOverride",
        c."createdAt",
        COUNT(o."id") AS "ordersCount",
        COALESCE(SUM(o."totalCents"), 0) AS "totalSpentCents"
      FROM "Client" c
      LEFT JOIN "Order" o ON o."clientId" = c."id"
      WHERE c."id" = $1
      GROUP BY
        c."id",
        c."name",
        c."type",
        c."email",
        c."phone",
        c."birthDate",
        c."address",
        c."notes",
        c."loyaltyLevelOverride",
        c."createdAt"
      LIMIT 1
    `,
    [clientId],
  );

  if (!result.rowCount) {
    return null;
  }

  return mapRowToClient(result.rows[0]);
}

export async function getClientByPhone(phone: string): Promise<Client | null> {
  const normalizedPhone = normalizeRussianPhoneForStorage(phone.trim());

  if (!normalizedPhone) {
    return null;
  }

  const result = await pool.query<ClientRow>(
    `
      SELECT
        c."id",
        c."name",
        c."type",
        c."email",
        c."phone",
        c."birthDate",
        c."address",
        c."notes",
        c."loyaltyLevelOverride",
        c."createdAt",
        COUNT(o."id") AS "ordersCount",
        COALESCE(SUM(o."totalCents"), 0) AS "totalSpentCents"
      FROM "Client" c
      LEFT JOIN "Order" o ON o."clientId" = c."id"
      WHERE c."phone" = $1
      GROUP BY
        c."id",
        c."name",
        c."type",
        c."email",
        c."phone",
        c."birthDate",
        c."address",
        c."notes",
        c."loyaltyLevelOverride",
        c."createdAt"
      LIMIT 1
    `,
    [normalizedPhone],
  );

  if (!result.rowCount) {
    return null;
  }

  return mapRowToClient(result.rows[0]);
}

export async function createClient(input: CreateClientInput): Promise<Client> {
  try {
    await ensureRecentDatabaseBackup("client-create");
    const result = await pool.query<ClientRow>(
      `
        INSERT INTO "Client" ("name", "type", "email", "phone", "birthDate", "address", "notes", "loyaltyLevelOverride")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING "id", "name", "type", "email", "phone", "birthDate", "address", "notes", "loyaltyLevelOverride", "createdAt"
      `,
      [
        input.name,
        input.type,
        input.email,
        input.phone,
        input.birthDate,
        input.address,
        input.notes,
        input.loyaltyLevelOverride,
      ],
    );

    return mapRowToClient(result.rows[0]);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ValidationError("Клиент или организация с таким номером телефона уже существует");
    }

    throw error;
  }
}

export async function updateClient(
  clientId: number,
  input: UpdateClientInput,
): Promise<Client | null> {
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return null;
  }

  try {
    await ensureRecentDatabaseBackup("client-update");
    const result = await pool.query<ClientRow>(
      `
        UPDATE "Client"
        SET
          "name" = $2,
          "type" = $3,
          "email" = $4,
          "phone" = $5,
          "birthDate" = $6,
          "address" = $7,
          "notes" = $8,
          "loyaltyLevelOverride" = $9
        WHERE "id" = $1
        RETURNING "id", "name", "type", "email", "phone", "birthDate", "address", "notes", "loyaltyLevelOverride", "createdAt"
      `,
      [
        clientId,
        input.name,
        input.type,
        input.email,
        input.phone,
        input.birthDate,
        input.address,
        input.notes,
        input.loyaltyLevelOverride,
      ],
    );

    if (!result.rowCount) {
      return null;
    }

    return mapRowToClient(result.rows[0]);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ValidationError("Клиент или организация с таким номером телефона уже существует");
    }

    throw error;
  }
}

export async function deleteClient(clientId: number): Promise<boolean> {
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return false;
  }

  await ensureRecentDatabaseBackup("client-delete");
  const result = await pool.query(
    `
      DELETE FROM "Client"
      WHERE "id" = $1
    `,
    [clientId],
  );

  return (result.rowCount ?? 0) > 0;
}
