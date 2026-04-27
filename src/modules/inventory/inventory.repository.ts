import { pool } from "@backend/shared/db/pool";
import { ensureRecentDatabaseBackup } from "@backend/shared/db/backup";
import { withTransaction } from "@backend/shared/db/transaction";
import { ValidationError } from "@backend/shared/errors/app-error";
import type {
  IncomingActItem,
  IncomingActSummary,
  InventoryResponsibleOption,
  InventorySession,
  InventorySessionItem,
  InventorySessionSummary,
  ProductItem,
  ProductCategory,
  WriteoffActItem,
  WriteoffActSummary,
  WriteoffReason,
} from "@backend/modules/inventory/inventory.types";
import type {
  InventorySessionActualInput,
  CreateIncomingActInput,
  CreateInventorySessionInput,
  CreateWriteoffActInput,
  InventoryAuditEntryInput,
  ProductInput,
} from "@backend/modules/inventory/inventory.validation";

type ProductRow = {
  id: number;
  name: string;
  sku: string | null;
  category: ProductCategory | null;
  unit: string;
  stockQuantity: number;
  priceCents: number;
  description: string | null;
  orderItemsCount?: string;
  createdAt: Date;
};

type InventorySessionRow = {
  id: number;
  responsibleEmployeeId: number;
  responsibleEmployeeName: string;
  responsibleEmployeeRole: string;
  notes: string | null;
  createdAt: Date;
  closedAt: Date | null;
  itemsCount?: string;
};

type IncomingActRow = {
  id: number;
  responsibleEmployeeId: number;
  responsibleEmployeeName: string;
  responsibleEmployeeRole: string;
  supplierName: string | null;
  notes: string | null;
  createdAt: Date;
  completedAt: Date | null;
  itemsCount?: string;
};

type IncomingActItemRow = {
  id: number;
  incomingActId: number;
  productId: number;
  productName: string;
  productCategory: string | null;
  productUnit: string;
  quantity: number;
  priceCents: number;
  currentStockQuantity: number;
  stockQuantityBefore: number | null;
  stockQuantityAfter: number | null;
};

type InventorySessionItemRow = {
  id: number;
  inventorySessionId: number;
  productId: number;
  productName: string;
  productCategory: string | null;
  productUnit: string;
  stockQuantity: number;
  currentStockQuantity: number;
  actualQuantity: number | null;
  priceCents: number;
};

type WriteoffActRow = {
  id: number;
  responsibleEmployeeId: number;
  responsibleEmployeeName: string;
  responsibleEmployeeRole: string;
  reason: string;
  notes: string | null;
  createdAt: Date;
  completedAt: Date | null;
  itemsCount?: string;
};

type WriteoffActItemRow = {
  id: number;
  writeoffActId: number;
  productId: number;
  productName: string;
  productCategory: string | null;
  productUnit: string;
  quantity: number;
  priceCents: number;
  currentStockQuantity: number;
  stockQuantityBefore: number | null;
  stockQuantityAfter: number | null;
};

const PRODUCT_SKU_SQL = `COALESCE(p."sku", CONCAT('PRD-', LPAD(p."id"::text, 5, '0')))` as const;

function mapRowToProduct(row: ProductRow): ProductItem {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    category: row.category,
    unit: row.unit,
    stockQuantity: row.stockQuantity,
    priceCents: row.priceCents,
    description: row.description,
    orderItemsCount: Number(row.orderItemsCount ?? 0),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapProductConflict(error: unknown): never {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  ) {
    throw new ValidationError("Товар с таким названием уже существует");
  }

  throw error;
}

function mapMissingWriteoffTables(error: unknown): never {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "42P01"
  ) {
    throw new ValidationError("Модуль списаний ещё не инициализирован в базе данных. Примените миграции для склада.");
  }

  throw error;
}

export type InventoryAuditResult = {
  checkedCount: number;
  updatedCount: number;
  differenceCount: number;
};

function mapInventorySessionItem(row: InventorySessionItemRow): InventorySessionItem {
  const varianceQuantity = row.actualQuantity === null ? null : row.actualQuantity - row.currentStockQuantity;

  return {
    id: row.id,
    productId: row.productId,
    productName: row.productName,
    productCategory: row.productCategory,
    productUnit: row.productUnit,
    stockQuantity: row.stockQuantity,
    currentStockQuantity: row.currentStockQuantity,
    actualQuantity: row.actualQuantity,
    priceCents: row.priceCents,
    varianceQuantity,
    varianceValueCents: varianceQuantity === null ? null : varianceQuantity * row.priceCents,
  };
}

function mapInventorySession(
  row: InventorySessionRow,
  items: InventorySessionItem[],
): InventorySession {
  return {
    id: row.id,
    responsibleEmployeeId: row.responsibleEmployeeId,
    responsibleEmployeeName: row.responsibleEmployeeName,
    responsibleEmployeeRole: row.responsibleEmployeeRole,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    isClosed: Boolean(row.closedAt),
    items,
  };
}

function mapIncomingActItem(row: IncomingActItemRow): IncomingActItem {
  return {
    id: row.id,
    productId: row.productId,
    productName: row.productName,
    productCategory: row.productCategory,
    productUnit: row.productUnit,
    quantity: row.quantity,
    priceCents: row.priceCents,
    totalCents: row.quantity * row.priceCents,
    currentStockQuantity: row.currentStockQuantity,
    stockQuantityBefore: row.stockQuantityBefore,
    stockQuantityAfter: row.stockQuantityAfter,
  };
}

function calculateWeightedAveragePriceCents(
  currentStockQuantity: number,
  currentPriceCents: number,
  incomingQuantity: number,
  incomingPriceCents: number,
) {
  if (incomingQuantity <= 0) {
    return currentPriceCents;
  }

  if (currentStockQuantity <= 0 || currentPriceCents <= 0) {
    return incomingPriceCents;
  }

  const totalQuantity = currentStockQuantity + incomingQuantity;

  if (totalQuantity <= 0) {
    return incomingPriceCents;
  }

  const totalValueCents =
    currentStockQuantity * currentPriceCents + incomingQuantity * incomingPriceCents;

  return Math.round(totalValueCents / totalQuantity);
}

function mapIncomingAct(
  row: IncomingActRow,
  items: IncomingActItem[],
): IncomingActSummary {
  return {
    id: row.id,
    responsibleEmployeeId: row.responsibleEmployeeId,
    responsibleEmployeeName: row.responsibleEmployeeName,
    responsibleEmployeeRole: row.responsibleEmployeeRole,
    supplierName: row.supplierName,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    isCompleted: Boolean(row.completedAt),
    itemsCount: Number(row.itemsCount ?? items.length),
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    totalCents: items.reduce((sum, item) => sum + item.totalCents, 0),
    items,
  };
}

function mapWriteoffActItem(row: WriteoffActItemRow): WriteoffActItem {
  return {
    id: row.id,
    productId: row.productId,
    productName: row.productName,
    productCategory: row.productCategory,
    productUnit: row.productUnit,
    quantity: row.quantity,
    priceCents: row.priceCents,
    totalCents: row.quantity * row.priceCents,
    currentStockQuantity: row.currentStockQuantity,
    stockQuantityBefore: row.stockQuantityBefore,
    stockQuantityAfter: row.stockQuantityAfter,
  };
}

function mapWriteoffAct(
  row: WriteoffActRow,
  items: WriteoffActItem[],
): WriteoffActSummary {
  return {
    id: row.id,
    responsibleEmployeeId: row.responsibleEmployeeId,
    responsibleEmployeeName: row.responsibleEmployeeName,
    responsibleEmployeeRole: row.responsibleEmployeeRole,
    reason: row.reason as WriteoffReason,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    isCompleted: Boolean(row.completedAt),
    itemsCount: Number(row.itemsCount ?? items.length),
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    totalCents: items.reduce((sum, item) => sum + item.totalCents, 0),
    items,
  };
}

async function getInventorySessionItemsBySessionIds(sessionIds: number[]) {
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

async function getWriteoffActItemsByActIds(actIds: number[]) {
  if (actIds.length === 0) {
    return {} as Record<number, WriteoffActItem[]>;
  }

  const result = await pool.query<WriteoffActItemRow>(
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
  ).catch((error: unknown) => {
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

async function getIncomingActItemsByActIds(actIds: number[]) {
  if (actIds.length === 0) {
    return {} as Record<number, IncomingActItem[]>;
  }

  const result = await pool.query<IncomingActItemRow>(
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
  ).catch((error: unknown) => {
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

async function ensureUniqueProductName(name: string, excludeProductId?: number) {
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

export async function getProducts(): Promise<ProductItem[]> {
  const result = await pool.query<ProductRow>(
    `
      SELECT
        p."id",
        p."name",
        ${PRODUCT_SKU_SQL} AS "sku",
        p."category",
        p."unit",
        p."stockQuantity",
        p."priceCents",
        p."description",
        p."createdAt",
        COUNT(oi."id") AS "orderItemsCount"
      FROM "Product" p
      LEFT JOIN "OrderItem" oi ON oi."productId" = p."id"
      GROUP BY
        p."id",
        p."name",
        p."sku",
        p."category",
        p."unit",
        p."stockQuantity",
        p."priceCents",
        p."description",
        p."createdAt"
      ORDER BY p."createdAt" DESC, p."id" DESC
    `,
  );

  return result.rows.map(mapRowToProduct);
}

export async function getInventoryResponsibleOptions(): Promise<InventoryResponsibleOption[]> {
  const result = await pool.query<{
    id: number;
    name: string;
    role: string;
  }>(
    `
      SELECT "id", "name", "role"
      FROM "Employee"
      ORDER BY LOWER("name") ASC, "id" ASC
    `,
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
  }));
}

export async function getProductById(productId: number): Promise<ProductItem | null> {
  if (!Number.isInteger(productId) || productId <= 0) {
    return null;
  }

  const result = await pool.query<ProductRow>(
    `
      SELECT
        p."id",
        p."name",
        ${PRODUCT_SKU_SQL} AS "sku",
        p."category",
        p."unit",
        p."stockQuantity",
        p."priceCents",
        p."description",
        p."createdAt",
        COUNT(oi."id") AS "orderItemsCount"
      FROM "Product" p
      LEFT JOIN "OrderItem" oi ON oi."productId" = p."id"
      WHERE p."id" = $1
      GROUP BY
        p."id",
        p."name",
        p."sku",
        p."category",
        p."unit",
        p."stockQuantity",
        p."priceCents",
        p."description",
        p."createdAt"
      LIMIT 1
    `,
    [productId],
  );

  return result.rows[0] ? mapRowToProduct(result.rows[0]) : null;
}

export async function createProduct(input: ProductInput): Promise<ProductItem> {
  await ensureUniqueProductName(input.name);
  try {
    return await withTransaction(async (client) => {
      const insertedProduct = await client.query<{ id: number }>(
        `
          INSERT INTO "Product" ("name", "category", "unit", "stockQuantity", "priceCents", "description")
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING "id"
        `,
        [
          input.name,
          input.category,
          input.unit,
          input.stockQuantity,
          input.priceCents,
          input.description,
        ],
      );

      const createdProductId = insertedProduct.rows[0]?.id;

      if (!createdProductId) {
        throw new ValidationError("Не удалось создать товар. Попробуйте ещё раз.");
      }

      const result = await client.query<ProductRow>(
        `
          UPDATE "Product"
          SET "sku" = CONCAT('PRD-', LPAD($2::text, 5, '0'))
          WHERE "id" = $1
          RETURNING "id", "name", "sku", "category", "unit", "stockQuantity", "priceCents", "description", "createdAt"
        `,
        [createdProductId, createdProductId],
      );

      const createdProduct = result.rows[0];

      if (!createdProduct) {
        throw new ValidationError("Не удалось сохранить внутренний код товара.");
      }

      return mapRowToProduct(createdProduct);
    });
  } catch (error) {
    mapProductConflict(error);
  }
}

export async function updateProduct(productId: number, input: ProductInput): Promise<ProductItem | null> {
  if (!Number.isInteger(productId) || productId <= 0) {
    return null;
  }

  try {
    await ensureRecentDatabaseBackup("product-update");
    await ensureUniqueProductName(input.name, productId);
    const result = await pool.query<ProductRow>(
      `
        UPDATE "Product"
        SET
          "name" = $2,
          "category" = $3,
          "unit" = $4,
          "stockQuantity" = $5,
          "priceCents" = $6,
          "description" = $7
        WHERE "id" = $1
        RETURNING "id", "name", "sku", "category", "unit", "stockQuantity", "priceCents", "description", "createdAt"
      `,
      [
        productId,
        input.name,
        input.category,
        input.unit,
        input.stockQuantity,
        input.priceCents,
        input.description,
      ],
    );

    return result.rows[0] ? mapRowToProduct(result.rows[0]) : null;
  } catch (error) {
    mapProductConflict(error);
  }
}

export async function deleteProduct(productId: number): Promise<boolean> {
  if (!Number.isInteger(productId) || productId <= 0) {
    return false;
  }

  const usageResult = await pool.query<{ count: string }>(
    `
      SELECT COUNT(*) AS count
      FROM "OrderItem"
      WHERE "productId" = $1
    `,
    [productId],
  );

  if (Number(usageResult.rows[0]?.count ?? 0) > 0) {
    return false;
  }

  await ensureRecentDatabaseBackup("product-delete");
  const result = await pool.query(
    `
      DELETE FROM "Product"
      WHERE "id" = $1
    `,
    [productId],
  );

  return (result.rowCount ?? 0) > 0;
}

export async function applyInventoryAudit(entries: InventoryAuditEntryInput[]): Promise<InventoryAuditResult> {
  if (entries.length === 0) {
    throw new ValidationError("Укажи фактический остаток хотя бы для одной позиции");
  }

  const productIds = entries.map((entry) => entry.productId);
  const currentProducts = await pool.query<Pick<ProductRow, "id" | "stockQuantity">>(
    `
      SELECT "id", "stockQuantity"
      FROM "Product"
      WHERE "id" = ANY($1::int[])
    `,
    [productIds],
  );

  if (currentProducts.rows.length !== entries.length) {
    throw new ValidationError("Часть товаров для инвентаризации уже недоступна. Обнови страницу и попробуй снова.");
  }

  const stockById = new Map(
    currentProducts.rows.map((row) => [row.id, row.stockQuantity]),
  );
  const changedEntries = entries.filter((entry) => stockById.get(entry.productId) !== entry.actualQuantity);

  await withTransaction(async (client) => {
    for (const entry of changedEntries) {
      await client.query(
        `
          UPDATE "Product"
          SET "stockQuantity" = $2
          WHERE "id" = $1
        `,
        [entry.productId, entry.actualQuantity],
      );
    }
  });

  return {
    checkedCount: entries.length,
    updatedCount: changedEntries.length,
    differenceCount: changedEntries.length,
  };
}

export async function createInventorySession(input: CreateInventorySessionInput): Promise<InventorySession> {
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
    throw new ValidationError("Часть выбранных товаров уже недоступна. Обнови страницу и собери лист заново.");
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

export async function getIncomingActs(): Promise<IncomingActSummary[]> {
  const actsResult = await pool.query<IncomingActRow>(
    `
      SELECT
        a."id",
        a."responsibleEmployeeId",
        e."name" AS "responsibleEmployeeName",
        e."role" AS "responsibleEmployeeRole",
        a."supplierName",
        a."notes",
        a."createdAt",
        a."completedAt",
        COUNT(i."id") AS "itemsCount"
      FROM "IncomingAct" a
      INNER JOIN "Employee" e ON e."id" = a."responsibleEmployeeId"
      LEFT JOIN "IncomingActItem" i ON i."incomingActId" = a."id"
      GROUP BY
        a."id",
        a."responsibleEmployeeId",
        e."name",
        e."role",
        a."supplierName",
        a."notes",
        a."createdAt",
        a."completedAt"
      ORDER BY a."createdAt" DESC, a."id" DESC
    `,
  ).catch((error: unknown) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "42P01"
    ) {
      return { rows: [] as IncomingActRow[] };
    }

    throw error;
  });

  const itemsByActId = await getIncomingActItemsByActIds(
    actsResult.rows.map((row) => row.id),
  );

  return actsResult.rows.map((row) => {
    const items = itemsByActId[row.id] ?? [];
    return mapIncomingAct(row, items);
  });
}

export async function getIncomingActById(
  actId: number,
): Promise<IncomingActSummary | null> {
  if (!Number.isInteger(actId) || actId <= 0) {
    return null;
  }

  const actResult = await pool.query<IncomingActRow>(
    `
      SELECT
        a."id",
        a."responsibleEmployeeId",
        e."name" AS "responsibleEmployeeName",
        e."role" AS "responsibleEmployeeRole",
        a."supplierName",
        a."notes",
        a."createdAt",
        a."completedAt",
        COUNT(i."id") AS "itemsCount"
      FROM "IncomingAct" a
      INNER JOIN "Employee" e ON e."id" = a."responsibleEmployeeId"
      LEFT JOIN "IncomingActItem" i ON i."incomingActId" = a."id"
      WHERE a."id" = $1
      GROUP BY
        a."id",
        a."responsibleEmployeeId",
        e."name",
        e."role",
        a."supplierName",
        a."notes",
        a."createdAt",
        a."completedAt"
      LIMIT 1
    `,
    [actId],
  );

  const act = actResult.rows[0];

  if (!act) {
    return null;
  }

  const itemsByActId = await getIncomingActItemsByActIds([act.id]);
  return mapIncomingAct(act, itemsByActId[act.id] ?? []);
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

export async function getWriteoffActs(): Promise<WriteoffActSummary[]> {
  const actsResult = await pool.query<WriteoffActRow>(
    `
      SELECT
        a."id",
        a."responsibleEmployeeId",
        e."name" AS "responsibleEmployeeName",
        e."role" AS "responsibleEmployeeRole",
        a."reason",
        a."notes",
        a."createdAt",
        a."completedAt",
        COUNT(i."id") AS "itemsCount"
      FROM "WriteoffAct" a
      INNER JOIN "Employee" e ON e."id" = a."responsibleEmployeeId"
      LEFT JOIN "WriteoffActItem" i ON i."writeoffActId" = a."id"
      GROUP BY
        a."id",
        a."responsibleEmployeeId",
        e."name",
        e."role",
        a."reason",
        a."notes",
        a."createdAt",
        a."completedAt"
      ORDER BY a."createdAt" DESC, a."id" DESC
    `,
  ).catch((error: unknown) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "42P01"
    ) {
      return { rows: [] as WriteoffActRow[] };
    }

    throw error;
  });

  const itemsByActId = await getWriteoffActItemsByActIds(
    actsResult.rows.map((row) => row.id),
  );

  return actsResult.rows.map((row) => {
    const items = itemsByActId[row.id] ?? [];
    return mapWriteoffAct(row, items);
  });
}

export async function createWriteoffAct(
  input: CreateWriteoffActInput,
): Promise<WriteoffActSummary> {
  try {
    const actId = await withTransaction(async (client) => {
      const responsibleResult = await client.query<{ id: number }>(
        `
          SELECT "id"
          FROM "Employee"
          WHERE "id" = $1
          LIMIT 1
        `,
        [input.responsibleEmployeeId],
      );

      if (!responsibleResult.rows[0]) {
        throw new ValidationError("Ответственный сотрудник не найден");
      }

      const productIds = input.items.map((item) => item.productId);
      const productsResult = await client.query<{
        id: number;
        name: string;
        category: string | null;
        unit: string;
        priceCents: number;
      }>(
        `
          SELECT "id", "name", "category", "unit", "priceCents"
          FROM "Product"
          WHERE "id" = ANY($1::int[])
        `,
        [productIds],
      );

      if (productsResult.rows.length !== productIds.length) {
        throw new ValidationError("Часть товаров для списания уже недоступна. Обнови страницу и попробуй снова.");
      }

      const productsById = new Map(productsResult.rows.map((row) => [row.id, row]));

      const actResult = await client.query<{ id: number }>(
        `
          INSERT INTO "WriteoffAct" ("responsibleEmployeeId", "reason", "notes")
          VALUES ($1, $2, $3)
          RETURNING "id"
        `,
        [input.responsibleEmployeeId, input.reason, input.notes],
      );

      const createdActId = actResult.rows[0]?.id;

      if (!createdActId) {
        throw new ValidationError("Не удалось создать акт списания");
      }

      for (const item of input.items) {
        const product = productsById.get(item.productId);

        if (!product) {
          throw new ValidationError("Товар для списания не найден");
        }

        await client.query(
          `
            INSERT INTO "WriteoffActItem" (
              "writeoffActId",
              "productId",
              "productName",
              "productCategory",
              "productUnit",
              "quantity",
              "priceCents"
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            createdActId,
            product.id,
            product.name,
            product.category,
            product.unit,
            item.quantity,
            product.priceCents,
          ],
        );
      }

      return createdActId;
    });

    const acts = await getWriteoffActs();
    const created = acts.find((act) => act.id === actId);

    if (!created) {
      throw new ValidationError("Акт списания создан, но не удалось прочитать его данные.");
    }

    return created;
  } catch (error) {
    mapMissingWriteoffTables(error);
  }
}

export async function createIncomingAct(
  input: CreateIncomingActInput,
): Promise<IncomingActSummary> {
  try {
    const actId = await withTransaction(async (client) => {
      const responsibleResult = await client.query<{ id: number }>(
        `
          SELECT "id"
          FROM "Employee"
          WHERE "id" = $1
          LIMIT 1
        `,
        [input.responsibleEmployeeId],
      );

      if (!responsibleResult.rows[0]) {
        throw new ValidationError("Ответственный сотрудник не найден");
      }

      const productIds = input.items.map((item) => item.productId);
      const productsResult = await client.query<{
        id: number;
        name: string;
        category: string | null;
        unit: string;
      }>(
        `
          SELECT "id", "name", "category", "unit"
          FROM "Product"
          WHERE "id" = ANY($1::int[])
        `,
        [productIds],
      );

      if (productsResult.rows.length !== productIds.length) {
        throw new ValidationError("Часть товаров для поступления уже недоступна. Обнови страницу и попробуй снова.");
      }

      const productsById = new Map(productsResult.rows.map((row) => [row.id, row]));

      const actResult = await client.query<{ id: number }>(
        `
          INSERT INTO "IncomingAct" ("responsibleEmployeeId", "supplierName", "notes")
          VALUES ($1, $2, $3)
          RETURNING "id"
        `,
        [input.responsibleEmployeeId, input.supplierName, input.notes],
      );

      const createdActId = actResult.rows[0]?.id;

      if (!createdActId) {
        throw new ValidationError("Не удалось создать акт поступления");
      }

      for (const item of input.items) {
        const product = productsById.get(item.productId);

        if (!product) {
          throw new ValidationError("Товар для поступления не найден");
        }

        await client.query(
          `
            INSERT INTO "IncomingActItem" (
              "incomingActId",
              "productId",
              "productName",
              "productCategory",
              "productUnit",
              "quantity",
              "priceCents"
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            createdActId,
            product.id,
            product.name,
            product.category,
            product.unit,
            item.quantity,
            item.priceCents,
          ],
        );
      }

      return createdActId;
    });

    const acts = await getIncomingActs();
    const created = acts.find((act) => act.id === actId);

    if (!created) {
      throw new ValidationError("Акт поступления создан, но не удалось прочитать его данные.");
    }

    return created;
  } catch (error) {
    mapMissingWriteoffTables(error);
  }
}

export async function updateIncomingAct(
  actId: number,
  input: CreateIncomingActInput,
): Promise<IncomingActSummary> {
  try {
    if (!Number.isInteger(actId) || actId <= 0) {
      throw new ValidationError("Акт поступления не найден");
    }

    const actResult = await pool.query<{ id: number; completedAt: Date | null }>(
      `
        SELECT "id", "completedAt"
        FROM "IncomingAct"
        WHERE "id" = $1
        LIMIT 1
      `,
      [actId],
    );

    const act = actResult.rows[0];

    if (!act) {
      throw new ValidationError("Акт поступления не найден");
    }

    if (act.completedAt) {
      throw new ValidationError("Завершённый акт поступления редактировать нельзя");
    }

    await withTransaction(async (client) => {
      const responsibleResult = await client.query<{ id: number }>(
        `
          SELECT "id"
          FROM "Employee"
          WHERE "id" = $1
          LIMIT 1
        `,
        [input.responsibleEmployeeId],
      );

      if (!responsibleResult.rows[0]) {
        throw new ValidationError("Ответственный сотрудник не найден");
      }

      const productIds = input.items.map((item) => item.productId);
      const productsResult = await client.query<{
        id: number;
        name: string;
        category: string | null;
        unit: string;
      }>(
        `
          SELECT "id", "name", "category", "unit"
          FROM "Product"
          WHERE "id" = ANY($1::int[])
        `,
        [productIds],
      );

      if (productsResult.rows.length !== productIds.length) {
        throw new ValidationError(
          "Часть товаров для поступления уже недоступна. Обнови страницу и попробуй снова.",
        );
      }

      const productsById = new Map(productsResult.rows.map((row) => [row.id, row]));

      await client.query(
        `
          UPDATE "IncomingAct"
          SET "responsibleEmployeeId" = $2,
              "supplierName" = $3,
              "notes" = $4
          WHERE "id" = $1
        `,
        [actId, input.responsibleEmployeeId, input.supplierName, input.notes],
      );

      await client.query(
        `
          DELETE FROM "IncomingActItem"
          WHERE "incomingActId" = $1
        `,
        [actId],
      );

      for (const item of input.items) {
        const product = productsById.get(item.productId);

        if (!product) {
          throw new ValidationError("Товар для поступления не найден");
        }

        await client.query(
          `
            INSERT INTO "IncomingActItem" (
              "incomingActId",
              "productId",
              "productName",
              "productCategory",
              "productUnit",
              "quantity",
              "priceCents"
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            actId,
            product.id,
            product.name,
            product.category,
            product.unit,
            item.quantity,
            item.priceCents,
          ],
        );
      }
    });

    const updated = await getIncomingActById(actId);

    if (!updated) {
      throw new ValidationError("Акт поступления обновлён, но не удалось прочитать его данные.");
    }

    return updated;
  } catch (error) {
    mapMissingWriteoffTables(error);
  }
}

export async function completeWriteoffAct(actId: number) {
  try {
    if (!Number.isInteger(actId) || actId <= 0) {
      throw new ValidationError("Акт списания не найден");
    }

    const actResult = await pool.query<{ id: number; completedAt: Date | null }>(
      `
        SELECT "id", "completedAt"
        FROM "WriteoffAct"
        WHERE "id" = $1
        LIMIT 1
      `,
      [actId],
    );

    const act = actResult.rows[0];

    if (!act) {
      throw new ValidationError("Акт списания не найден");
    }

    if (act.completedAt) {
      throw new ValidationError("Этот акт списания уже завершён");
    }

    const itemsResult = await pool.query<{
      id: number;
      productId: number;
      quantity: number;
    }>(
      `
        SELECT "id", "productId", "quantity"
        FROM "WriteoffActItem"
        WHERE "writeoffActId" = $1
        ORDER BY "id" ASC
      `,
      [actId],
    );

    if (!itemsResult.rowCount) {
      throw new ValidationError("В акте списания нет ни одной строки");
    }

    await withTransaction(async (client) => {
      for (const item of itemsResult.rows) {
        const productResult = await client.query<{ stockQuantity: number; priceCents: number }>(
          `
            SELECT "stockQuantity"
            FROM "Product"
            WHERE "id" = $1
            LIMIT 1
          `,
          [item.productId],
        );

        const currentStockQuantity = productResult.rows[0]?.stockQuantity;

        if (typeof currentStockQuantity !== "number") {
          throw new ValidationError("Часть товаров из акта списания уже недоступна");
        }

        const stockQuantityAfter = currentStockQuantity - item.quantity;

        await client.query(
          `
            UPDATE "Product"
            SET "stockQuantity" = $2
            WHERE "id" = $1
          `,
          [item.productId, stockQuantityAfter],
        );

        await client.query(
          `
            UPDATE "WriteoffActItem"
            SET "stockQuantityBefore" = $2,
                "stockQuantityAfter" = $3
            WHERE "id" = $1
          `,
          [item.id, currentStockQuantity, stockQuantityAfter],
        );
      }

      await client.query(
        `
          UPDATE "WriteoffAct"
          SET "completedAt" = CURRENT_TIMESTAMP
          WHERE "id" = $1
        `,
        [actId],
      );
    });
  } catch (error) {
    mapMissingWriteoffTables(error);
  }
}

export async function completeIncomingAct(actId: number) {
  try {
    if (!Number.isInteger(actId) || actId <= 0) {
      throw new ValidationError("Акт поступления не найден");
    }

    const actResult = await pool.query<{ id: number; completedAt: Date | null }>(
      `
        SELECT "id", "completedAt"
        FROM "IncomingAct"
        WHERE "id" = $1
        LIMIT 1
      `,
      [actId],
    );

    const act = actResult.rows[0];

    if (!act) {
      throw new ValidationError("Акт поступления не найден");
    }

    if (act.completedAt) {
      throw new ValidationError("Этот акт поступления уже завершён");
    }

    const itemsResult = await pool.query<{
      id: number;
      productId: number;
      quantity: number;
      priceCents: number;
    }>(
      `
        SELECT "id", "productId", "quantity", "priceCents"
        FROM "IncomingActItem"
        WHERE "incomingActId" = $1
        ORDER BY "id" ASC
      `,
      [actId],
    );

    if (!itemsResult.rowCount) {
      throw new ValidationError("В акте поступления нет ни одной строки");
    }

    await withTransaction(async (client) => {
      for (const item of itemsResult.rows) {
        const productResult = await client.query<{ stockQuantity: number; priceCents: number }>(
          `
            SELECT "stockQuantity", "priceCents"
            FROM "Product"
            WHERE "id" = $1
            LIMIT 1
          `,
          [item.productId],
        );

        const currentStockQuantity = productResult.rows[0]?.stockQuantity;
        const currentPriceCents = productResult.rows[0]?.priceCents;

        if (typeof currentStockQuantity !== "number" || typeof currentPriceCents !== "number") {
          throw new ValidationError("Часть товаров из акта поступления уже недоступна");
        }

        const stockQuantityAfter = currentStockQuantity + item.quantity;
        const nextPriceCents = calculateWeightedAveragePriceCents(
          currentStockQuantity,
          currentPriceCents,
          item.quantity,
          item.priceCents,
        );

        await client.query(
          `
            UPDATE "Product"
            SET "stockQuantity" = $2,
                "priceCents" = $3
            WHERE "id" = $1
          `,
          [item.productId, stockQuantityAfter, nextPriceCents],
        );

        await client.query(
          `
            UPDATE "IncomingActItem"
            SET "stockQuantityBefore" = $2,
                "stockQuantityAfter" = $3
            WHERE "id" = $1
          `,
          [item.id, currentStockQuantity, stockQuantityAfter],
        );
      }

      await client.query(
        `
          UPDATE "IncomingAct"
          SET "completedAt" = CURRENT_TIMESTAMP
          WHERE "id" = $1
        `,
        [actId],
      );
    });
  } catch (error) {
    mapMissingWriteoffTables(error);
  }
}

export async function deleteWriteoffAct(actId: number) {
  try {
    if (!Number.isInteger(actId) || actId <= 0) {
      throw new ValidationError("Акт списания не найден");
    }

    const actResult = await pool.query<{ id: number; completedAt: Date | null }>(
      `
        SELECT "id", "completedAt"
        FROM "WriteoffAct"
        WHERE "id" = $1
        LIMIT 1
      `,
      [actId],
    );

    const act = actResult.rows[0];

    if (!act) {
      throw new ValidationError("Акт списания не найден");
    }

    const itemsResult = await pool.query<{
      productId: number;
      quantity: number;
    }>(
      `
        SELECT "productId", "quantity"
        FROM "WriteoffActItem"
        WHERE "writeoffActId" = $1
        ORDER BY "id" ASC
      `,
      [actId],
    );

    await withTransaction(async (client) => {
      if (act.completedAt) {
        for (const item of itemsResult.rows) {
          const productResult = await client.query<{ stockQuantity: number }>(
            `
              SELECT "stockQuantity"
              FROM "Product"
              WHERE "id" = $1
              LIMIT 1
            `,
            [item.productId],
          );

          const currentStockQuantity = productResult.rows[0]?.stockQuantity;

          if (typeof currentStockQuantity !== "number") {
            throw new ValidationError("Часть товаров из акта списания уже недоступна, остатки восстановить нельзя");
          }

          await client.query(
            `
              UPDATE "Product"
              SET "stockQuantity" = $2
              WHERE "id" = $1
            `,
            [item.productId, currentStockQuantity + item.quantity],
          );
        }
      }

      await client.query(
        `
          DELETE FROM "WriteoffAct"
          WHERE "id" = $1
        `,
        [actId],
      );
    });
  } catch (error) {
    mapMissingWriteoffTables(error);
  }
}

export async function deleteIncomingAct(actId: number) {
  try {
    if (!Number.isInteger(actId) || actId <= 0) {
      throw new ValidationError("Акт поступления не найден");
    }

    const actResult = await pool.query<{ id: number; completedAt: Date | null }>(
      `
        SELECT "id", "completedAt"
        FROM "IncomingAct"
        WHERE "id" = $1
        LIMIT 1
      `,
      [actId],
    );

    const act = actResult.rows[0];

    if (!act) {
      throw new ValidationError("Акт поступления не найден");
    }

    const itemsResult = await pool.query<{
      productId: number;
      quantity: number;
    }>(
      `
        SELECT "productId", "quantity"
        FROM "IncomingActItem"
        WHERE "incomingActId" = $1
        ORDER BY "id" ASC
      `,
      [actId],
    );

    await withTransaction(async (client) => {
      if (act.completedAt) {
        for (const item of itemsResult.rows) {
          const productResult = await client.query<{ stockQuantity: number }>(
            `
              SELECT "stockQuantity"
              FROM "Product"
              WHERE "id" = $1
              LIMIT 1
            `,
            [item.productId],
          );

          const currentStockQuantity = productResult.rows[0]?.stockQuantity;

          if (typeof currentStockQuantity !== "number") {
            throw new ValidationError(
              "Часть товаров из акта поступления уже недоступна, остатки скорректировать нельзя",
            );
          }

          await client.query(
            `
              UPDATE "Product"
              SET "stockQuantity" = $2
              WHERE "id" = $1
            `,
            [item.productId, currentStockQuantity - item.quantity],
          );
        }
      }

      await client.query(
        `
          DELETE FROM "IncomingAct"
          WHERE "id" = $1
        `,
        [actId],
      );
    });
  } catch (error) {
    mapMissingWriteoffTables(error);
  }
}

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
