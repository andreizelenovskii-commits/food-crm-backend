import { pool } from "@backend/shared/db/pool";
import { withTransaction } from "@backend/shared/db/transaction";
import { ValidationError } from "@backend/shared/errors/app-error";
import type {
  InventorySession,
  InventorySessionItem,
  InventorySessionSummary,
} from "@backend/modules/inventory/inventory.types";
import type { CreateInventorySessionInput } from "@backend/modules/inventory/inventory.validation";
import {
  getInventorySessionItemsBySessionIds,
  mapInventorySession,
  mapInventorySessionItem,
} from "@backend/modules/inventory/inventory.repository.internals";
import {
  PRODUCT_SKU_SQL,
  type InventorySessionItemRow,
  type InventorySessionRow,
  type ProductRow,
} from "@backend/modules/inventory/inventory.repository.rows";

export async function createInventorySession(
  input: CreateInventorySessionInput,
): Promise<InventorySession> {
  const responsibleResult = await pool.query<{ id: number; name: string; role: string }>(
    `
      SELECT "id", "name", "role"
      FROM "Employee"
      WHERE "id" = $1
      LIMIT 1
    `,
    [input.responsibleEmployeeId],
  );

  const responsible = responsibleResult.rows[0];

  if (!responsible) {
    throw new ValidationError("Ответственный сотрудник не найден");
  }

  const productsResult = await pool.query<ProductRow>(
    `
      SELECT
        p."id",
        p."name",
        ${PRODUCT_SKU_SQL} AS "sku",
        p."category",
        p."kitchenZone",
        p."unit",
        p."stockQuantity",
        p."priceCents",
        p."description",
        p."createdAt"
      FROM "Product" p
      WHERE p."id" = ANY($1::int[])
      ORDER BY LOWER(p."name") ASC, p."id" ASC
    `,
    [input.productIds],
  );

  if (productsResult.rows.length !== input.productIds.length) {
    throw new ValidationError(
      "Часть выбранных товаров уже недоступна. Обнови страницу и собери лист заново.",
    );
  }

  return withTransaction(async (client) => {
    const sessionResult = await client.query<InventorySessionRow>(
      `
        INSERT INTO "InventorySession" ("responsibleEmployeeId", "notes")
        VALUES ($1, $2)
        RETURNING
          "id",
          "responsibleEmployeeId",
          "notes",
          "createdAt",
          "closedAt"
      `,
      [input.responsibleEmployeeId, input.notes],
    );

    const session = sessionResult.rows[0];

    if (!session) {
      throw new ValidationError("Не удалось создать лист инвентаризации");
    }

    const items: InventorySessionItem[] = [];

    for (const productId of input.productIds) {
      const product = productsResult.rows.find((row) => row.id === productId);

      if (!product) {
        continue;
      }

      const itemResult = await client.query<InventorySessionItemRow>(
        `
          INSERT INTO "InventorySessionItem" (
            "inventorySessionId",
            "productId",
            "productName",
            "productCategory",
            "productUnit",
            "stockQuantity",
            "actualQuantity"
          )
          VALUES ($1, $2, $3, $4, $5, $6, NULL)
          RETURNING
            "id",
            "inventorySessionId",
            "productId",
            "productName",
            "productCategory",
            "productUnit",
            "stockQuantity",
            "stockQuantity" AS "currentStockQuantity",
            "actualQuantity",
            $7::int AS "priceCents"
        `,
        [
          session.id,
          product.id,
          product.name,
          product.category,
          product.unit,
          product.stockQuantity,
          product.priceCents,
        ],
      );

      const createdItem = itemResult.rows[0];

      if (createdItem) {
        items.push(mapInventorySessionItem(createdItem));
      }
    }

    return mapInventorySession(
      {
        ...session,
        responsibleEmployeeName: responsible.name,
        responsibleEmployeeRole: responsible.role,
      },
      items,
    );
  });
}

export async function getInventorySessions(): Promise<InventorySessionSummary[]> {
  const sessionsResult = await pool.query<InventorySessionRow>(
    `
      SELECT
        s."id",
        s."responsibleEmployeeId",
        e."name" AS "responsibleEmployeeName",
        e."role" AS "responsibleEmployeeRole",
        s."notes",
        s."createdAt",
        s."closedAt",
        COUNT(i."id") AS "itemsCount"
      FROM "InventorySession" s
      INNER JOIN "Employee" e ON e."id" = s."responsibleEmployeeId"
      LEFT JOIN "InventorySessionItem" i ON i."inventorySessionId" = s."id"
      GROUP BY
        s."id",
        s."responsibleEmployeeId",
        e."name",
        e."role",
        s."notes",
        s."createdAt",
        s."closedAt"
      ORDER BY s."createdAt" DESC, s."id" DESC
    `,
  );

  const itemsBySessionId = await getInventorySessionItemsBySessionIds(
    sessionsResult.rows.map((row) => row.id),
  );

  return sessionsResult.rows.map((row) => {
    const items = itemsBySessionId[row.id] ?? [];

    return {
      id: row.id,
      responsibleEmployeeId: row.responsibleEmployeeId,
      responsibleEmployeeName: row.responsibleEmployeeName,
      responsibleEmployeeRole: row.responsibleEmployeeRole,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      closedAt: row.closedAt ? row.closedAt.toISOString() : null,
      isClosed: Boolean(row.closedAt),
      itemsCount: Number(row.itemsCount ?? items.length),
      totalQuantity: items.reduce((sum, item) => sum + item.stockQuantity, 0),
      categories: Array.from(
        new Set(
          items
            .map((item) => item.productCategory)
            .filter((category): category is string => Boolean(category)),
        ),
      ),
      items,
    };
  });
}

export async function getInventorySessionById(
  sessionId: number,
): Promise<InventorySessionSummary | null> {
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return null;
  }

  const sessionResult = await pool.query<InventorySessionRow>(
    `
      SELECT
        s."id",
        s."responsibleEmployeeId",
        e."name" AS "responsibleEmployeeName",
        e."role" AS "responsibleEmployeeRole",
        s."notes",
        s."createdAt",
        s."closedAt",
        COUNT(i."id") AS "itemsCount"
      FROM "InventorySession" s
      INNER JOIN "Employee" e ON e."id" = s."responsibleEmployeeId"
      LEFT JOIN "InventorySessionItem" i ON i."inventorySessionId" = s."id"
      WHERE s."id" = $1
      GROUP BY
        s."id",
        s."responsibleEmployeeId",
        e."name",
        e."role",
        s."notes",
        s."createdAt",
        s."closedAt"
      LIMIT 1
    `,
    [sessionId],
  );

  const row = sessionResult.rows[0];

  if (!row) {
    return null;
  }

  const itemsBySessionId = await getInventorySessionItemsBySessionIds([row.id]);
  const items = itemsBySessionId[row.id] ?? [];

  return {
    id: row.id,
    responsibleEmployeeId: row.responsibleEmployeeId,
    responsibleEmployeeName: row.responsibleEmployeeName,
    responsibleEmployeeRole: row.responsibleEmployeeRole,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    isClosed: Boolean(row.closedAt),
    itemsCount: Number(row.itemsCount ?? items.length),
    totalQuantity: items.reduce((sum, item) => sum + item.stockQuantity, 0),
    categories: Array.from(
      new Set(
        items
          .map((item) => item.productCategory)
          .filter((category): category is string => Boolean(category)),
      ),
    ),
    items,
  };
}
