import { pool } from "@backend/shared/db/pool";
import type {
  OrderListItem,
  OrderStatus,
} from "@backend/modules/orders/orders.types";
import {
  mapRowToOrder,
  type OrderRow,
} from "@backend/modules/orders/orders.repository.shared";

export { createOrder } from "@backend/modules/orders/orders.repository.create";

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

  return result.rows.map(mapRowToOrder);
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
        o."isInternal",
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

  return result.rows.map(mapRowToOrder);
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

  if (!result.rowCount) {
    return null;
  }

  return mapRowToOrder(result.rows[0]);
}
