import { pool } from "@backend/shared/db/pool";
import { ensureRecentDatabaseBackup } from "@backend/shared/db/backup";
import { withTransaction } from "@backend/shared/db/transaction";
import { ValidationError } from "@backend/shared/errors/app-error";
import type { InventoryResponsibleOption, ProductItem } from "@backend/modules/inventory/inventory.types";
import type { ProductInput } from "@backend/modules/inventory/inventory.validation";
import {
  ensureUniqueProductName,
  mapProductConflict,
  mapRowToProduct,
} from "@backend/modules/inventory/inventory.repository.internals";
import { PRODUCT_SKU_SQL, type ProductRow } from "@backend/modules/inventory/inventory.repository.rows";

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
