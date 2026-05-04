import { pool } from "@backend/shared/db/pool";
import { ValidationError } from "@backend/shared/errors/app-error";
import type {
  IncomingActItem,
  InventorySessionItem,
  WriteoffActItem,
} from "@backend/modules/inventory/inventory.types";
import type {
  IncomingActItemRow,
  InventorySessionItemRow,
  WriteoffActItemRow,
} from "@backend/modules/inventory/inventory.repository.rows";
import {
  mapIncomingActItem,
  mapInventorySessionItem,
  mapWriteoffActItem,
} from "@backend/modules/inventory/inventory.repository.mappers";

export async function getInventorySessionItemsBySessionIds(sessionIds: number[]) {
  if (sessionIds.length === 0) {
    return {} as Record<number, InventorySessionItem[]>;
  }

  const result = await pool.query<InventorySessionItemRow>(
    `
      SELECT
        i."id",
        i."inventorySessionId",
        i."productId",
        i."productName",
        i."productCategory",
        i."productUnit",
        i."stockQuantity",
        p."stockQuantity" AS "currentStockQuantity",
        i."actualQuantity",
        p."priceCents"
      FROM "InventorySessionItem" i
      INNER JOIN "Product" p ON p."id" = i."productId"
      WHERE i."inventorySessionId" = ANY($1::int[])
      ORDER BY LOWER(i."productName") ASC, i."id" ASC
    `,
    [sessionIds],
  );

  return result.rows.reduce<Record<number, InventorySessionItem[]>>((acc, row) => {
    const current = acc[row.inventorySessionId] ?? [];
    current.push(mapInventorySessionItem(row));
    acc[row.inventorySessionId] = current;
    return acc;
  }, {});
}

export async function getWriteoffActItemsByActIds(actIds: number[]) {
  if (actIds.length === 0) {
    return {} as Record<number, WriteoffActItem[]>;
  }

  const result = await pool
    .query<WriteoffActItemRow>(
      `
      SELECT
        i."id",
        i."writeoffActId",
        i."productId",
        i."productName",
        i."productCategory",
        i."productUnit",
        i."quantity",
        i."priceCents",
        p."stockQuantity" AS "currentStockQuantity",
        i."stockQuantityBefore",
        i."stockQuantityAfter"
      FROM "WriteoffActItem" i
      INNER JOIN "Product" p ON p."id" = i."productId"
      WHERE i."writeoffActId" = ANY($1::int[])
      ORDER BY LOWER(i."productName") ASC, i."id" ASC
    `,
      [actIds],
    )
    .catch((error: unknown) => {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "42P01"
      ) {
        return { rows: [] as WriteoffActItemRow[] };
      }

      throw error;
    });

  return result.rows.reduce<Record<number, WriteoffActItem[]>>((acc, row) => {
    const current = acc[row.writeoffActId] ?? [];
    current.push(mapWriteoffActItem(row));
    acc[row.writeoffActId] = current;
    return acc;
  }, {});
}

export async function getIncomingActItemsByActIds(actIds: number[]) {
  if (actIds.length === 0) {
    return {} as Record<number, IncomingActItem[]>;
  }

  const result = await pool
    .query<IncomingActItemRow>(
      `
      SELECT
        i."id",
        i."incomingActId",
        i."productId",
        i."productName",
        i."productCategory",
        i."productUnit",
        i."quantity",
        i."priceCents",
        p."stockQuantity" AS "currentStockQuantity",
        i."stockQuantityBefore",
        i."stockQuantityAfter"
      FROM "IncomingActItem" i
      INNER JOIN "Product" p ON p."id" = i."productId"
      WHERE i."incomingActId" = ANY($1::int[])
      ORDER BY LOWER(i."productName") ASC, i."id" ASC
    `,
      [actIds],
    )
    .catch((error: unknown) => {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "42P01"
      ) {
        return { rows: [] as IncomingActItemRow[] };
      }

      throw error;
    });

  return result.rows.reduce<Record<number, IncomingActItem[]>>((acc, row) => {
    const current = acc[row.incomingActId] ?? [];
    current.push(mapIncomingActItem(row));
    acc[row.incomingActId] = current;
    return acc;
  }, {});
}

export async function ensureUniqueProductName(name: string, excludeProductId?: number) {
  const result = await pool.query<{ id: number }>(
    `
      SELECT "id"
      FROM "Product"
      WHERE LOWER("name") = LOWER($1)
        AND ($2::int IS NULL OR "id" <> $2)
      LIMIT 1
    `,
    [name, excludeProductId ?? null],
  );

  if (result.rows[0]) {
    throw new ValidationError("Товар с таким названием уже существует");
  }
}
