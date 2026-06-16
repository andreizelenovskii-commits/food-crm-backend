import type { PoolClient } from "pg";
import { pool } from "@backend/shared/db/pool";
import { withTransaction } from "@backend/shared/db/transaction";
import type {
  KitchenZone,
  OrderListItem,
  OrderStatus,
} from "@backend/modules/orders/orders.types";
import { consumeOrderStockForStatus } from "@backend/modules/orders/orders.inventory";
import { ValidationError } from "@backend/shared/errors/app-error";
import {
  DELIVERY_ITEM_NAME,
  mapExcludedIngredient,
  mapOrderItem,
  mapPackagingUsage,
  mapRowToOrder,
  type OrderItemRow,
  type OrderItemExcludedIngredientRow,
  type OrderPackagingUsageRow,
  type OrderRow,
  resolveKitchenZone,
} from "@backend/modules/orders/orders.repository.shared";

export { createOrder } from "@backend/modules/orders/orders.repository.create";

function isKitchenZone(value: string | null | undefined): value is KitchenZone {
  return value === "pizza" || value === "rolls" || value === "fastfood" || value === "dispatch";
}

function normalizeOrderItemKitchenZones(
  kitchenZones: string[],
  kitchenZone: string | null,
  category: string | null,
) {
  const zones = kitchenZones.filter(isKitchenZone);

  if (zones.length) {
    return zones;
  }

  const fallback = isKitchenZone(kitchenZone) ? kitchenZone : resolveKitchenZone(category);
  return fallback ? [fallback] : [];
}

export async function getOrderById(orderId: number): Promise<OrderListItem | null> {
  const result = await pool.query<OrderRow>(
    `
      SELECT
        o."id",
        o."status",
        o."source",
        o."isInternal",
        o."customerPhoneSnapshot",
        o."deliveryAddressSnapshot",
        o."customerComment",
        o."subtotalCents",
        o."discountPercent",
        o."totalCents",
        o."createdAt",
        c."id" AS "clientId",
        COALESCE(c."name", o."clientNameSnapshot") AS "clientName",
        COALESCE(c."type", o."clientTypeSnapshot") AS "clientType",
        e."id" AS "employeeId",
        e."name" AS "employeeName"
      FROM "Order" o
      LEFT JOIN "Client" c ON c."id" = o."clientId"
      INNER JOIN "Employee" e ON e."id" = o."employeeId"
      WHERE o."id" = $1
      LIMIT 1
    `,
    [orderId],
  );

  if (!result.rowCount) {
    return null;
  }

  return (await attachItemsToOrders([mapRowToOrder(result.rows[0])]))[0] ?? null;
}

export async function getOrders(): Promise<OrderListItem[]> {
  const result = await pool.query<OrderRow>(
    `
      SELECT
        o."id",
        o."status",
        o."source",
        o."isInternal",
        o."customerPhoneSnapshot",
        o."deliveryAddressSnapshot",
        o."customerComment",
        o."subtotalCents",
        o."discountPercent",
        o."totalCents",
        o."createdAt",
        c."id" AS "clientId",
        COALESCE(c."name", o."clientNameSnapshot") AS "clientName",
        COALESCE(c."type", o."clientTypeSnapshot") AS "clientType",
        e."id" AS "employeeId",
        e."name" AS "employeeName"
      FROM "Order" o
      LEFT JOIN "Client" c ON c."id" = o."clientId"
      INNER JOIN "Employee" e ON e."id" = o."employeeId"
      ORDER BY o."createdAt" DESC, o."id" DESC
    `,
  );

  return attachItemsToOrders(result.rows.map(mapRowToOrder));
}

export async function getOrdersByClientId(clientId: number): Promise<OrderListItem[]> {
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return [];
  }

  const result = await pool.query<OrderRow>(
    `
      SELECT
        o."id",
        o."status",
        o."source",
        o."isInternal",
        o."customerPhoneSnapshot",
        o."deliveryAddressSnapshot",
        o."customerComment",
        o."subtotalCents",
        o."discountPercent",
        o."totalCents",
        o."createdAt",
        c."id" AS "clientId",
        COALESCE(c."name", o."clientNameSnapshot") AS "clientName",
        COALESCE(c."type", o."clientTypeSnapshot") AS "clientType",
        e."id" AS "employeeId",
        e."name" AS "employeeName"
      FROM "Order" o
      LEFT JOIN "Client" c ON c."id" = o."clientId"
      INNER JOIN "Employee" e ON e."id" = o."employeeId"
      WHERE o."clientId" = $1
      ORDER BY o."createdAt" DESC, o."id" DESC
    `,
    [clientId],
  );

  return attachItemsToOrders(result.rows.map(mapRowToOrder));
}

export async function updateOrderStatus(
  orderId: number,
  status: OrderStatus,
  expectedCurrentStatus: OrderStatus,
  actorUserId?: number,
): Promise<OrderListItem | null> {
  const updatedOrder = await withTransaction(async (client) => {
    const currentOrder = await client.query<{ id: number; status: OrderStatus }>(
      `
        SELECT "id", "status"
        FROM "Order"
        WHERE "id" = $1
        FOR UPDATE
      `,
      [orderId],
    );

    if (!currentOrder.rowCount) {
      return null;
    }

    if (currentOrder.rows[0].status !== expectedCurrentStatus) {
      throw new ValidationError("Статус заказа уже изменился. Обновите страницу и повторите действие.");
    }

    await consumeOrderStockForStatus(client, orderId, status, actorUserId);

    const result = await client.query<OrderRow>(
      `
        UPDATE "Order" o
        SET "status" = $2
        WHERE o."id" = $1
        RETURNING
          o."id",
          o."status",
          o."source",
          o."isInternal",
          o."customerPhoneSnapshot",
          o."deliveryAddressSnapshot",
          o."customerComment",
          o."subtotalCents",
          o."discountPercent",
          o."totalCents",
          o."createdAt",
          (SELECT c."id" FROM "Client" c WHERE c."id" = o."clientId") AS "clientId",
          COALESCE(
            (SELECT c."name" FROM "Client" c WHERE c."id" = o."clientId"),
            o."clientNameSnapshot"
          ) AS "clientName",
          COALESCE(
            (SELECT c."type" FROM "Client" c WHERE c."id" = o."clientId"),
            o."clientTypeSnapshot"
          ) AS "clientType",
          (SELECT e."id" FROM "Employee" e WHERE e."id" = o."employeeId") AS "employeeId",
          (SELECT e."name" FROM "Employee" e WHERE e."id" = o."employeeId") AS "employeeName"
      `,
      [orderId, status],
    );

    return result.rowCount ? mapRowToOrder(result.rows[0]) : null;
  });

  return updatedOrder ? (await attachItemsToOrders([updatedOrder]))[0] ?? null : null;
}

export async function addOrderPackagingUsage({
  orderId,
  orderItemId,
  unitIndex,
  inputKitchenZone,
  packageProductId,
  actorUserId,
}: {
  orderId: number;
  orderItemId: number;
  unitIndex: number;
  inputKitchenZone?: string;
  packageProductId: number;
  actorUserId?: number;
}) {
  await withTransaction(async (client) => {
    const itemResult = await client.query<{
      id: number;
      orderId: number;
      quantity: number;
      itemName: string;
      catalogCategory: string | null;
      kitchenZone: string | null;
      kitchenZones: string[];
    }>(
      `
        SELECT
          oi."id",
          oi."orderId",
          oi."quantity",
          oi."itemName",
          ci."category" AS "catalogCategory",
          ci."kitchenZone",
          COALESCE(ci."kitchenZones", ARRAY[]::text[]) AS "kitchenZones"
        FROM "OrderItem" oi
        LEFT JOIN "CatalogItem" ci ON ci."id" = oi."catalogItemId"
        WHERE oi."id" = $1 AND oi."orderId" = $2
        FOR UPDATE
      `,
      [orderItemId, orderId],
    );

    const item = itemResult.rows[0];

    if (!item) {
      throw new ValidationError("Позиция заказа не найдена");
    }

    const allowedKitchenZones = normalizeOrderItemKitchenZones(item.kitchenZones, item.kitchenZone, item.catalogCategory);
    const kitchenZone = inputKitchenZone && isKitchenZone(inputKitchenZone)
      ? inputKitchenZone
      : allowedKitchenZones[0] ?? null;

    if (!kitchenZone || !allowedKitchenZones.includes(kitchenZone)) {
      throw new ValidationError(`Для позиции "${item.itemName}" не определена кухонная зона`);
    }

    if (!Number.isInteger(unitIndex) || unitIndex < 1 || unitIndex > item.quantity) {
      throw new ValidationError("Выберите корректную единицу позиции заказа");
    }

    const existingUsage = await client.query<{ id: number }>(
      `
        SELECT "id"
        FROM "OrderPackagingUsage"
        WHERE "orderItemId" = $1 AND "unitIndex" = $2 AND "kitchenZone" = $3
        LIMIT 1
      `,
      [orderItemId, unitIndex, kitchenZone],
    );

    if (existingUsage.rowCount) {
      throw new ValidationError("Для этой позиции упаковка уже выбрана");
    }

    const packageResult = await client.query<{
      id: number;
      name: string;
      unit: string;
      stockQuantity: number;
      kitchenZone: string | null;
    }>(
      `
        SELECT "id", "name", "unit", "stockQuantity", "kitchenZone"
        FROM "Product"
        WHERE "id" = $1 AND "category" = 'Упаковка'
        FOR UPDATE
      `,
      [packageProductId],
    );

    const packaging = packageResult.rows[0];

    if (!packaging) {
      throw new ValidationError("Упаковка не найдена на складе");
    }

    if (packaging.unit !== "шт") {
      throw new ValidationError("Упаковка должна списываться в штуках");
    }

    if (packaging.kitchenZone !== kitchenZone) {
      throw new ValidationError("Эта упаковка не привязана к зоне блюда");
    }

    if (packaging.stockQuantity < 1) {
      throw new ValidationError(`Упаковка "${packaging.name}" закончилась на складе`);
    }

    const stockAfter = packaging.stockQuantity - 1;

    await client.query(
      `
        UPDATE "Product"
        SET "stockQuantity" = $2
        WHERE "id" = $1
      `,
      [packaging.id, stockAfter],
    );

    await client.query(
      `
        INSERT INTO "OrderPackagingUsage" (
          "orderId",
          "orderItemId",
          "unitIndex",
          "packageProductId",
          "packageProductName",
          "kitchenZone",
          "actorUserId",
          "stockQuantityBefore",
          "stockQuantityAfter"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        orderId,
        orderItemId,
        unitIndex,
        packaging.id,
        packaging.name,
        kitchenZone,
        actorUserId ?? null,
        packaging.stockQuantity,
        stockAfter,
      ],
    );

    await upsertPackagingMovement(
      client,
      orderId,
      packaging.id,
      packaging.name,
      packaging.stockQuantity,
      stockAfter,
      actorUserId,
    );
  });

  return getOrderById(orderId);
}

async function upsertPackagingMovement(
  client: PoolClient,
  orderId: number,
  productId: number,
  productName: string,
  stockBefore: number,
  stockAfter: number,
  actorUserId?: number,
) {
  const movement = await client.query<{ id: number; quantity: number }>(
    `
      SELECT "id", "quantity"
      FROM "OrderInventoryMovement"
      WHERE "orderId" = $1 AND "productId" = $2 AND "movementType" = 'PACKAGE'
      LIMIT 1
    `,
    [orderId, productId],
  );

  if (movement.rowCount) {
    await client.query(
      `
        UPDATE "OrderInventoryMovement"
        SET
          "quantity" = "quantity" + 1,
          "actorUserId" = $2,
          "stockQuantityAfter" = $3
        WHERE "id" = $1
      `,
      [movement.rows[0].id, actorUserId ?? null, stockAfter],
    );
    return;
  }

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
      VALUES ($1, $2, $3, 'шт', 1, 'PACKAGE', 'READY', $4, $5, $6, $7)
    `,
    [
      orderId,
      productId,
      productName,
      `Заказ #${orderId}: упаковка`,
      actorUserId ?? null,
      stockBefore,
      stockAfter,
    ],
  );
}

async function attachItemsToOrders(orders: OrderListItem[]): Promise<OrderListItem[]> {
  if (!orders.length) {
    return orders;
  }

  const orderIds = orders.map((order) => order.id);
  const itemsResult = await pool.query<OrderItemRow>(
    `
      SELECT
        oi."id",
        oi."orderId",
        oi."catalogItemId",
        oi."catalogItemVariantId",
        oi."itemName",
        oi."quantity",
        oi."unitPriceCents",
        oi."totalPriceCents",
        ci."category" AS "catalogCategory",
        ci."kitchenZone",
        COALESCE(ci."kitchenZones", ARRAY[]::text[]) AS "kitchenZones"
      FROM "OrderItem" oi
      LEFT JOIN "CatalogItem" ci ON ci."id" = oi."catalogItemId"
      WHERE oi."orderId" = ANY($1::int[])
        AND oi."itemName" <> $2
      ORDER BY oi."id" ASC
    `,
    [orderIds, DELIVERY_ITEM_NAME],
  );
  const itemIds = itemsResult.rows.map((item) => item.id);
  const exclusionsResult = itemIds.length
    ? await pool.query<OrderItemExcludedIngredientRow>(
        `
          SELECT
            "id",
            "orderItemId",
            "productId",
            "label"
          FROM "OrderItemExcludedIngredient"
          WHERE "orderItemId" = ANY($1::int[])
          ORDER BY "id" ASC
        `,
        [itemIds],
      )
    : { rows: [] as OrderItemExcludedIngredientRow[] };
  const usagesResult = itemIds.length
    ? await pool.query<OrderPackagingUsageRow>(
        `
          SELECT
            "id",
            "orderItemId",
            "unitIndex",
            "packageProductId",
            "packageProductName",
            "kitchenZone",
            "createdAt"
          FROM "OrderPackagingUsage"
          WHERE "orderItemId" = ANY($1::int[])
          ORDER BY "unitIndex" ASC, "id" ASC
        `,
        [itemIds],
      )
    : { rows: [] as OrderPackagingUsageRow[] };

  const usagesByItemId = new Map<number, ReturnType<typeof mapPackagingUsage>[]>();
  const exclusionsByItemId = new Map<number, ReturnType<typeof mapExcludedIngredient>[]>();

  for (const row of exclusionsResult.rows) {
    const itemExclusions = exclusionsByItemId.get(row.orderItemId) ?? [];
    itemExclusions.push(mapExcludedIngredient(row));
    exclusionsByItemId.set(row.orderItemId, itemExclusions);
  }

  for (const usage of usagesResult.rows.map(mapPackagingUsage)) {
    const itemUsages = usagesByItemId.get(usage.orderItemId) ?? [];
    itemUsages.push(usage);
    usagesByItemId.set(usage.orderItemId, itemUsages);
  }

  const itemsByOrderId = new Map<number, ReturnType<typeof mapOrderItem>[]>();

  for (const item of itemsResult.rows) {
    const orderItems = itemsByOrderId.get(item.orderId) ?? [];
    orderItems.push(mapOrderItem(
      item,
      usagesByItemId.get(item.id) ?? [],
      exclusionsByItemId.get(item.id) ?? [],
    ));
    itemsByOrderId.set(item.orderId, orderItems);
  }

  return orders.map((order) => ({
    ...order,
    items: itemsByOrderId.get(order.id) ?? [],
  }));
}
