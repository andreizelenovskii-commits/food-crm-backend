import { pool } from "@backend/shared/db/pool";
import { withTransaction } from "@backend/shared/db/transaction";
import { ValidationError } from "@backend/shared/errors/app-error";
import type { InventorySessionActualInput } from "@backend/modules/inventory/inventory.validation";

export async function saveInventorySessionActuals(
  sessionId: number,
  entries: InventorySessionActualInput[],
) {
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    throw new ValidationError("Инвентаризация не найдена");
  }

  const sessionResult = await pool.query<{ id: number; closedAt: Date | null }>(
    `
      SELECT "id", "closedAt"
      FROM "InventorySession"
      WHERE "id" = $1
      LIMIT 1
    `,
    [sessionId],
  );

  const session = sessionResult.rows[0];

  if (!session) {
    throw new ValidationError("Инвентаризация не найдена");
  }

  if (session.closedAt) {
    throw new ValidationError("Эта инвентаризация уже закрыта");
  }

  await withTransaction(async (client) => {
    for (const entry of entries) {
      await client.query(
        `
          UPDATE "InventorySessionItem"
          SET "actualQuantity" = $3
          WHERE "id" = $1
            AND "inventorySessionId" = $2
        `,
        [entry.itemId, sessionId, entry.actualQuantity],
      );
    }
  });
}

export async function closeInventorySession(sessionId: number) {
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    throw new ValidationError("Инвентаризация не найдена");
  }

  const sessionResult = await pool.query<{ id: number; closedAt: Date | null }>(
    `
      SELECT "id", "closedAt"
      FROM "InventorySession"
      WHERE "id" = $1
      LIMIT 1
    `,
    [sessionId],
  );

  const session = sessionResult.rows[0];

  if (!session) {
    throw new ValidationError("Инвентаризация не найдена");
  }

  if (session.closedAt) {
    throw new ValidationError("Эта инвентаризация уже закрыта");
  }

  const itemsResult = await pool.query<{
    id: number;
    productId: number;
    actualQuantity: number | null;
  }>(
    `
      SELECT "id", "productId", "actualQuantity"
      FROM "InventorySessionItem"
      WHERE "inventorySessionId" = $1
      ORDER BY "id" ASC
    `,
    [sessionId],
  );

  if (!itemsResult.rowCount) {
    throw new ValidationError("В инвентаризации нет ни одной строки");
  }

  const unfilledItems = itemsResult.rows.filter((item) => item.actualQuantity === null);

  if (unfilledItems.length > 0) {
    throw new ValidationError("Чтобы закрыть инвентаризацию, укажи фактический остаток для всех товаров");
  }

  await withTransaction(async (client) => {
    for (const item of itemsResult.rows) {
      await client.query(
        `
          UPDATE "Product"
          SET "stockQuantity" = $2
          WHERE "id" = $1
        `,
        [item.productId, item.actualQuantity],
      );
    }

    await client.query(
      `
        UPDATE "InventorySession"
        SET "closedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $1
      `,
      [sessionId],
    );
  });
}

export async function deleteInventorySession(sessionId: number) {
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    throw new ValidationError("Инвентаризация не найдена");
  }

  const sessionResult = await pool.query<{ id: number; closedAt: Date | null }>(
    `
      SELECT "id", "closedAt"
      FROM "InventorySession"
      WHERE "id" = $1
      LIMIT 1
    `,
    [sessionId],
  );

  const session = sessionResult.rows[0];

  if (!session) {
    throw new ValidationError("Инвентаризация не найдена");
  }

  if (!session.closedAt) {
    throw new ValidationError("Удалить можно только закрытую инвентаризацию");
  }

  const itemsResult = await pool.query<{
    productId: number;
    stockQuantity: number;
    actualQuantity: number | null;
    currentStockQuantity: number;
  }>(
    `
      SELECT
        i."productId",
        i."stockQuantity",
        i."actualQuantity",
        p."stockQuantity" AS "currentStockQuantity"
      FROM "InventorySessionItem" i
      INNER JOIN "Product" p ON p."id" = i."productId"
      WHERE i."inventorySessionId" = $1
      ORDER BY i."id" ASC
    `,
    [sessionId],
  );

  await withTransaction(async (client) => {
    for (const item of itemsResult.rows) {
      if (item.actualQuantity === null) {
        continue;
      }

      const revertedQuantity =
        item.currentStockQuantity + (item.stockQuantity - item.actualQuantity);

      await client.query(
        `
          UPDATE "Product"
          SET "stockQuantity" = $2
          WHERE "id" = $1
        `,
        [item.productId, Math.max(0, revertedQuantity)],
      );
    }

    await client.query(
      `
        DELETE FROM "InventorySessionItem"
        WHERE "inventorySessionId" = $1
      `,
      [sessionId],
    );

    await client.query(
      `
        DELETE FROM "InventorySession"
        WHERE "id" = $1
      `,
      [sessionId],
    );
  });
}
