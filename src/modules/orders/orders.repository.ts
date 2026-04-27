import { pool } from "@backend/shared/db/pool";
import { withTransaction } from "@backend/shared/db/transaction";
import { ValidationError } from "@backend/shared/errors/app-error";
import { getLoyaltyDiscountPercent, resolveLoyaltyLevel } from "@backend/modules/loyalty/loyalty.rules";
import type {
  OrderCreateInput,
  OrderListItem,
  OrderStatus,
} from "@backend/modules/orders/orders.types";

type OrderRow = {
  id: number;
  status: string;
  isInternal: boolean;
  clientId: number;
  clientName: string;
  clientType: "CLIENT" | "ORGANIZATION";
  employeeId: number;
  employeeName: string;
  subtotalCents: number;
  discountPercent: number;
  totalCents: number;
  createdAt: Date;
};

type CatalogOrderItemRow = {
  id: number;
  name: string;
  priceCents: number;
  isPublished: boolean;
};

const DELIVERY_ITEM_NAME = "Доставка";

function normalizeDbOrderStatus(status: string): OrderStatus {
  switch (status) {
    case "PENDING":
      return "SENT_TO_KITCHEN";
    case "PROCESSING":
      return "READY";
    case "COMPLETED":
      return "DELIVERED_PAID";
    case "SENT_TO_KITCHEN":
    case "READY":
    case "PACKED":
    case "DELIVERED_PAID":
    case "CANCELLED":
      return status;
    default:
      return "SENT_TO_KITCHEN";
  }
}

function mapRowToOrder(row: OrderRow): OrderListItem {
  return {
    id: row.id,
    status: normalizeDbOrderStatus(row.status),
    isInternal: row.isInternal,
    clientId: row.clientId,
    clientName: row.clientName,
    clientType: row.clientType,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    subtotalCents: row.subtotalCents,
    discountPercent: row.discountPercent,
    totalCents: row.totalCents,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getOrderById(orderId: number): Promise<OrderListItem | null> {
  const result = await pool.query<OrderRow>(
    `
      SELECT
        o."id",
        o."status",
        o."isInternal",
        o."subtotalCents",
        o."discountPercent",
        o."totalCents",
        o."createdAt",
        c."id" AS "clientId",
        c."name" AS "clientName",
        c."type" AS "clientType",
        e."id" AS "employeeId",
        e."name" AS "employeeName"
      FROM "Order" o
      INNER JOIN "Client" c ON c."id" = o."clientId"
      INNER JOIN "Employee" e ON e."id" = o."employeeId"
      WHERE o."id" = $1
      LIMIT 1
    `,
    [orderId],
  );

  if (!result.rowCount) {
    return null;
  }

  return mapRowToOrder(result.rows[0]);
}

export async function getOrders(): Promise<OrderListItem[]> {
  const result = await pool.query<OrderRow>(
    `
      SELECT
        o."id",
        o."status",
        o."isInternal",
        o."subtotalCents",
        o."discountPercent",
        o."totalCents",
        o."createdAt",
        c."id" AS "clientId",
        c."name" AS "clientName",
        c."type" AS "clientType",
        e."id" AS "employeeId",
        e."name" AS "employeeName"
      FROM "Order" o
      INNER JOIN "Client" c ON c."id" = o."clientId"
      INNER JOIN "Employee" e ON e."id" = o."employeeId"
      ORDER BY o."createdAt" DESC, o."id" DESC
    `,
  );

  return result.rows.map(mapRowToOrder);
}

export async function createOrder(input: OrderCreateInput): Promise<OrderListItem> {
  return withTransaction(async (client) => {
    const clientExists = await client.query<{ id: number; type: "CLIENT" | "ORGANIZATION"; totalSpentCents: string }>(
      `
        SELECT
          c."id",
          c."type",
          COALESCE(SUM(o."totalCents"), 0) AS "totalSpentCents"
        FROM "Client" c
        LEFT JOIN "Order" o ON o."clientId" = c."id"
        WHERE c."id" = $1
        GROUP BY c."id", c."type"
        LIMIT 1
      `,
      [input.clientId],
    );

    if (!clientExists.rowCount) {
      throw new ValidationError("Клиент не найден");
    }

    const employeeExists = await client.query<{ id: number }>(
      `SELECT "id" FROM "Employee" WHERE "id" = $1 LIMIT 1`,
      [input.employeeId],
    );

    if (!employeeExists.rowCount) {
      throw new ValidationError("Сотрудник не найден");
    }

    const catalogItemIds = input.items.map((item) => item.catalogItemId);
    const catalogItemsResult = await client.query<CatalogOrderItemRow>(
      `
        SELECT "id", "name", "priceCents", "isPublished"
        FROM "CatalogItem"
        WHERE "id" = ANY($1::int[])
      `,
      [catalogItemIds],
    );

    if (catalogItemsResult.rowCount !== catalogItemIds.length) {
      throw new ValidationError("Часть позиций заказа не найдена в каталоге");
    }

    const catalogItemsById = new Map(catalogItemsResult.rows.map((item) => [item.id, item]));
    const expectedIsPublished = !input.isInternal;
    const orderItems = input.items.map((item) => {
      const catalogItem = catalogItemsById.get(item.catalogItemId);

      if (!catalogItem) {
        throw new ValidationError("Часть позиций заказа не найдена в каталоге");
      }

      if (catalogItem.isPublished !== expectedIsPublished) {
        throw new ValidationError(
          input.isInternal
            ? "Во внутренний заказ можно добавлять только позиции из внутреннего прайса"
            : "В клиентский заказ можно добавлять только позиции из клиентского прайса",
        );
      }

      return {
        catalogItemId: catalogItem.id,
        itemName: catalogItem.name,
        quantity: item.quantity,
        unitPriceCents: catalogItem.priceCents,
        totalPriceCents: catalogItem.priceCents * item.quantity,
      };
    });

    const subtotalCents = orderItems.reduce((sum, item) => sum + item.totalPriceCents, 0);
    const deliveryFeeCents = input.isInternal ? 0 : input.deliveryFeeCents;
    const currentClient = clientExists.rows[0];
    const discountPercent =
      !input.isInternal && currentClient.type === "CLIENT"
        ? getLoyaltyDiscountPercent(resolveLoyaltyLevel(Number(currentClient.totalSpentCents ?? 0)))
        : 0;
    const discountCents = Math.round((subtotalCents * discountPercent) / 100);
    const totalCents = Math.max(subtotalCents - discountCents, 0) + deliveryFeeCents;

    const result = await client.query<OrderRow>(
      `
        INSERT INTO "Order" (
          "status",
          "isInternal",
          "clientId",
          "employeeId",
          "subtotalCents",
          "discountPercent",
          "totalCents"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          "id",
          "status",
          "isInternal",
          "subtotalCents",
          "discountPercent",
          "totalCents",
          "createdAt",
          (SELECT c."id" FROM "Client" c WHERE c."id" = $3) AS "clientId",
          (SELECT c."name" FROM "Client" c WHERE c."id" = $3) AS "clientName",
          (SELECT c."type" FROM "Client" c WHERE c."id" = $3) AS "clientType",
          (SELECT e."id" FROM "Employee" e WHERE e."id" = $4) AS "employeeId",
          (SELECT e."name" FROM "Employee" e WHERE e."id" = $4) AS "employeeName"
      `,
      [
        input.status,
        input.isInternal,
        input.clientId,
        input.employeeId,
        subtotalCents,
        discountPercent,
        totalCents,
      ],
    );

    const order = result.rows[0];

    for (const item of orderItems) {
      await client.query(
        `
          INSERT INTO "OrderItem" (
            "orderId",
            "catalogItemId",
            "itemName",
            "quantity",
            "unitPriceCents",
            "totalPriceCents"
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          order.id,
          item.catalogItemId,
          item.itemName,
          item.quantity,
          item.unitPriceCents,
          item.totalPriceCents,
        ],
      );
    }

    if (deliveryFeeCents > 0) {
      await client.query(
        `
          INSERT INTO "OrderItem" (
            "orderId",
            "catalogItemId",
            "itemName",
            "quantity",
            "unitPriceCents",
            "totalPriceCents"
          )
          VALUES ($1, NULL, $2, 1, $3, $3)
        `,
        [order.id, DELIVERY_ITEM_NAME, deliveryFeeCents],
      );
    }

    return mapRowToOrder(order);
  });
}

export async function updateOrderStatus(
  orderId: number,
  status: OrderStatus,
): Promise<OrderListItem | null> {
  const result = await pool.query<OrderRow>(
    `
      UPDATE "Order" o
      SET "status" = $2
      WHERE o."id" = $1
      RETURNING
        o."id",
        o."status",
        o."isInternal",
        o."subtotalCents",
        o."discountPercent",
        o."totalCents",
        o."createdAt",
        (SELECT c."id" FROM "Client" c WHERE c."id" = o."clientId") AS "clientId",
        (SELECT c."name" FROM "Client" c WHERE c."id" = o."clientId") AS "clientName",
        (SELECT c."type" FROM "Client" c WHERE c."id" = o."clientId") AS "clientType",
        (SELECT e."id" FROM "Employee" e WHERE e."id" = o."employeeId") AS "employeeId",
        (SELECT e."name" FROM "Employee" e WHERE e."id" = o."employeeId") AS "employeeName"
    `,
    [orderId, status],
  );

  if (!result.rowCount) {
    return null;
  }

  return mapRowToOrder(result.rows[0]);
}
