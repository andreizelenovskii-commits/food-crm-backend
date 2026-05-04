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
