import type { PoolClient } from "pg";
import { ValidationError } from "@backend/shared/errors/app-error";
import type { OrderStatus } from "@backend/modules/orders/orders.types";
import { assertStockCanDecrease } from "@backend/modules/inventory/inventory.stock-guard";

const STOCK_CONSUMPTION_STATUS: OrderStatus = "READY";

type IngredientRequirement = {
  productId: number;
  productName: string;
  productUnit: string;
  requiredQuantity: number;
};

type ProductStock = {
  id: number;
  stockQuantity: number;
};

export function shouldConsumeOrderStock(status: OrderStatus) {
  return status === STOCK_CONSUMPTION_STATUS;
}

export async function consumeOrderStockForStatus(
  client: PoolClient,
  orderId: number,
  status: OrderStatus,
  actorUserId?: number,
) {
  if (!shouldConsumeOrderStock(status)) {
    return;
  }

  const existingMovement = await client.query<{ id: number }>(
    `
      SELECT "id"
      FROM "OrderInventoryMovement"
      WHERE "orderId" = $1 AND "movementType" = 'CONSUME'
      LIMIT 1
    `,
    [orderId],
  );

  if (existingMovement.rowCount) {
    return;
  }

  await assertOrderItemsHaveConsumableTechCards(client, orderId);
  const requirements = await getIngredientRequirements(client, orderId);

  if (!requirements.length) {
    return;
  }

  const productIds = requirements.map((item) => item.productId);
  const stocks = await client.query<ProductStock>(
    `
      SELECT "id", "stockQuantity"
      FROM "Product"
      WHERE "id" = ANY($1::int[])
      FOR UPDATE
    `,
    [productIds],
  );
  const stocksById = new Map(stocks.rows.map((row) => [row.id, row.stockQuantity]));

  for (const item of requirements) {
    const currentStock = stocksById.get(item.productId);

    if (typeof currentStock !== "number") {
      throw new ValidationError(`Ингредиент "${item.productName}" уже недоступен на складе`);
    }

    assertStockCanDecrease(currentStock, item.requiredQuantity, {
      productName: item.productName,
      productUnit: item.productUnit,
    });
  }

  for (const item of requirements) {
    const currentStock = stocksById.get(item.productId) ?? 0;
    const nextStock = currentStock - item.requiredQuantity;

    await client.query(
      `
        UPDATE "Product"
        SET "stockQuantity" = $2
        WHERE "id" = $1
      `,
      [item.productId, nextStock],
    );

    await insertInventoryMovement(client, orderId, status, item, currentStock, nextStock, actorUserId);
  }
}

async function assertOrderItemsHaveConsumableTechCards(client: PoolClient, orderId: number) {
  const invalidItems = await client.query<{ itemName: string; issue: string }>(
    `
      SELECT oi."itemName",
        CASE
          WHEN ci."id" IS NULL THEN 'catalog'
          WHEN tc."outputQuantity" <= 0 THEN 'output'
          WHEN NOT EXISTS (
            SELECT 1 FROM "TechCardIngredient" tci
            WHERE tci."technologicalCardId" = ci."technologicalCardId"
          ) THEN 'ingredients'
          ELSE 'unknown'
        END AS "issue"
      FROM "OrderItem" oi
      LEFT JOIN "CatalogItem" ci ON ci."id" = oi."catalogItemId"
      LEFT JOIN "TechnologicalCard" tc ON tc."id" = ci."technologicalCardId"
      WHERE oi."orderId" = $1
        AND oi."catalogItemId" IS NOT NULL
        AND (
          ci."id" IS NULL OR tc."outputQuantity" <= 0 OR NOT EXISTS (
            SELECT 1 FROM "TechCardIngredient" tci
            WHERE tci."technologicalCardId" = ci."technologicalCardId"
          )
        )
    `,
    [orderId],
  );

  if (invalidItems.rowCount) {
    throw new ValidationError(buildTechCardError(invalidItems.rows[0]));
  }
}

async function getIngredientRequirements(client: PoolClient, orderId: number) {
  const result = await client.query<IngredientRequirement>(
    `
      SELECT
        p."id" AS "productId",
        p."name" AS "productName",
        p."unit" AS "productUnit",
        SUM(oi."quantity" * tci."quantity" / tc."outputQuantity") AS "requiredQuantity"
      FROM "OrderItem" oi
      INNER JOIN "CatalogItem" ci ON ci."id" = oi."catalogItemId"
      INNER JOIN "TechnologicalCard" tc ON tc."id" = ci."technologicalCardId"
      INNER JOIN "TechCardIngredient" tci ON tci."technologicalCardId" = tc."id"
      INNER JOIN "Product" p ON p."id" = tci."productId"
      WHERE oi."orderId" = $1
      GROUP BY p."id", p."name", p."unit"
      ORDER BY p."name" ASC
    `,
    [orderId],
  );

  return result.rows.map((row) => ({
    ...row,
    requiredQuantity: Number(row.requiredQuantity),
  }));
}

async function insertInventoryMovement(
  client: PoolClient,
  orderId: number,
  status: OrderStatus,
  item: IngredientRequirement,
  stockBefore: number,
  stockAfter: number,
  actorUserId?: number,
) {
  await client.query(
    `
      INSERT INTO "OrderInventoryMovement" (
        "orderId",
        "productId",
        "productName",
        "productUnit",
        "quantity",
        "movementType",
        "orderStatus",
        "reason",
        "actorUserId",
        "stockQuantityBefore",
        "stockQuantityAfter"
      )
      VALUES ($1, $2, $3, $4, $5, 'CONSUME', $6, $7, $8, $9, $10)
    `,
    [
      orderId,
      item.productId,
      item.productName,
      item.productUnit,
      item.requiredQuantity,
      status,
      `Заказ #${orderId}: приготовление`,
      actorUserId ?? null,
      stockBefore,
      stockAfter,
    ],
  );
}

function buildTechCardError(row: { itemName: string; issue: string }) {
  if (row.issue === "ingredients") {
    return `В техкарте позиции "${row.itemName}" нет ингредиентов`;
  }

  if (row.issue === "output") {
    return `В техкарте позиции "${row.itemName}" некорректный выход`;
  }

  return `Позиция "${row.itemName}" не связана с корректной техкартой`;
}
