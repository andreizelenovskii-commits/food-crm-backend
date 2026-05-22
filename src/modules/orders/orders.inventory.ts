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
          WHEN COALESCE(vtc."outputQuantity", tc."outputQuantity") <= 0 THEN 'output'
          WHEN NOT EXISTS (
            SELECT 1 FROM "TechCardIngredient" tci
            WHERE tci."technologicalCardId" = COALESCE(v."technologicalCardId", ci."technologicalCardId")
          ) AND NOT EXISTS (
            SELECT 1 FROM "TechCardComponent" tcc
            WHERE tcc."technologicalCardId" = COALESCE(v."technologicalCardId", ci."technologicalCardId")
          ) AND NOT EXISTS (
            SELECT 1 FROM "TechCardChoiceSlot" tcs
            WHERE tcs."technologicalCardId" = COALESCE(v."technologicalCardId", ci."technologicalCardId")
          ) THEN 'ingredients'
          WHEN EXISTS (
            SELECT 1 FROM "TechCardChoiceSlot" tcs
            WHERE tcs."technologicalCardId" = COALESCE(v."technologicalCardId", ci."technologicalCardId")
              AND NOT EXISTS (
                SELECT 1 FROM "OrderItemChoice" oic
                WHERE oic."orderItemId" = oi."id"
                  AND oic."choiceSlotId" = tcs."id"
              )
          ) THEN 'ingredients'
          ELSE 'unknown'
        END AS "issue"
      FROM "OrderItem" oi
      LEFT JOIN "CatalogItem" ci ON ci."id" = oi."catalogItemId"
      LEFT JOIN "CatalogItemVariant" v ON v."id" = oi."catalogItemVariantId"
      LEFT JOIN "TechnologicalCard" tc ON tc."id" = ci."technologicalCardId"
      LEFT JOIN "TechnologicalCard" vtc ON vtc."id" = v."technologicalCardId"
      WHERE oi."orderId" = $1
        AND oi."catalogItemId" IS NOT NULL
        AND (
          ci."id" IS NULL OR COALESCE(vtc."outputQuantity", tc."outputQuantity") <= 0 OR (
            NOT EXISTS (
            SELECT 1 FROM "TechCardIngredient" tci
            WHERE tci."technologicalCardId" = COALESCE(v."technologicalCardId", ci."technologicalCardId")
            )
            AND NOT EXISTS (
              SELECT 1 FROM "TechCardComponent" tcc
              WHERE tcc."technologicalCardId" = COALESCE(v."technologicalCardId", ci."technologicalCardId")
            )
            AND NOT EXISTS (
              SELECT 1 FROM "TechCardChoiceSlot" tcs
              WHERE tcs."technologicalCardId" = COALESCE(v."technologicalCardId", ci."technologicalCardId")
            )
          ) OR EXISTS (
            SELECT 1 FROM "TechCardChoiceSlot" tcs
            WHERE tcs."technologicalCardId" = COALESCE(v."technologicalCardId", ci."technologicalCardId")
              AND NOT EXISTS (
                SELECT 1 FROM "OrderItemChoice" oic
                WHERE oic."orderItemId" = oi."id"
                  AND oic."choiceSlotId" = tcs."id"
              )
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
      WITH RECURSIVE card_tree AS (
        SELECT
          tc."id" AS "cardId",
          oi."id" AS "orderItemId",
          (oi."quantity"::numeric / NULLIF(tc."outputQuantity", 0)) AS "multiplier"
        FROM "OrderItem" oi
        INNER JOIN "CatalogItem" ci ON ci."id" = oi."catalogItemId"
        LEFT JOIN "CatalogItemVariant" v ON v."id" = oi."catalogItemVariantId"
        INNER JOIN "TechnologicalCard" tc ON tc."id" = COALESCE(v."technologicalCardId", ci."technologicalCardId")
        WHERE oi."orderId" = $1

        UNION ALL

        SELECT
          child."id" AS "cardId",
          card_tree."orderItemId",
          card_tree."multiplier" * component."quantity" / NULLIF(child."outputQuantity", 0)
        FROM card_tree
        INNER JOIN "TechCardComponent" component
          ON component."technologicalCardId" = card_tree."cardId"
        INNER JOIN "TechnologicalCard" child
          ON child."id" = component."componentTechnologicalCardId"

        UNION ALL

        SELECT
          selected_child."id" AS "cardId",
          card_tree."orderItemId",
          card_tree."multiplier" * choice."quantity" / NULLIF(selected_child."outputQuantity", 0)
        FROM card_tree
        INNER JOIN "TechCardChoiceSlot" slot
          ON slot."technologicalCardId" = card_tree."cardId"
        INNER JOIN "OrderItemChoice" choice
          ON choice."orderItemId" = card_tree."orderItemId"
          AND choice."choiceSlotId" = slot."id"
        INNER JOIN "TechnologicalCard" selected_child
          ON selected_child."id" = choice."selectedTechnologicalCardId"
      )
      SELECT
        p."id" AS "productId",
        p."name" AS "productName",
        p."unit" AS "productUnit",
        SUM(card_tree."multiplier" * tci."quantity") AS "requiredQuantity"
      FROM card_tree
      INNER JOIN "TechCardIngredient" tci ON tci."technologicalCardId" = card_tree."cardId"
      INNER JOIN "Product" p ON p."id" = tci."productId"
      WHERE NOT EXISTS (
        SELECT 1
        FROM "OrderItemExcludedIngredient" excluded
        WHERE excluded."orderItemId" = card_tree."orderItemId"
          AND excluded."productId" = tci."productId"
      )
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
