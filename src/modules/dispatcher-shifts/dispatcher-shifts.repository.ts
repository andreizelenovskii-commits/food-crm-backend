import type { PoolClient } from "pg";
import { pool } from "@backend/shared/db/pool";
import { ACTIVE_ORDER_STATUSES } from "@backend/modules/orders/orders.workflow";
import type { OrderListItem, OrderStatus } from "@backend/modules/orders/orders.types";
import { attachItemsToOrders } from "@backend/modules/orders/orders.repository";
import {
  mapRowToOrder,
  type OrderRow,
} from "@backend/modules/orders/orders.repository.shared";
import {
  BUSINESS_TIME_ZONE,
  formatShiftNumber,
  getBusinessDateUtc,
  toBusinessDate,
} from "@backend/modules/dispatcher-shifts/dispatcher-shifts.time";
import type { DispatcherShift, DispatcherShiftStatus } from "@backend/modules/dispatcher-shifts/dispatcher-shifts.types";

type ShiftRow = {
  id: number;
  number: number;
  businessDate: Date;
  status: DispatcherShiftStatus;
  timeZone: string;
  openedAt: Date;
  closedAt: Date | null;
  responsibleName: string;
  closedByName: string | null;
  openedByUserId: number;
  closedByUserId: number | null;
  checksCountSnapshot: number | null;
  revenueCentsSnapshot: number | null;
  cancelledOrdersSnapshot: number | null;
  totalOrdersSnapshot: number | null;
  activeOrdersCount: string | number;
  liveChecksCount: string | number;
  liveRevenueCents: string | number;
  liveCancelledOrdersCount: string | number;
  liveTotalOrdersCount: string | number;
};

type Queryable = Pick<PoolClient, "query">;

export type ShiftMetrics = {
  activeOrdersCount: number;
  checksCount: number;
  revenueCents: number;
  cancelledOrdersCount: number;
  totalOrdersCount: number;
};

const ACTIVE_STATUS_SQL = ACTIVE_ORDER_STATUSES.map((status) => `'${status}'`).join(", ");

function toInt(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function mapShiftRow(row: ShiftRow): DispatcherShift {
  const isClosed = row.status === "CLOSED";
  const checksCount = isClosed ? row.checksCountSnapshot : toInt(row.liveChecksCount);
  const revenueCents = isClosed ? row.revenueCentsSnapshot : toInt(row.liveRevenueCents);
  const cancelledOrdersCount = isClosed ? row.cancelledOrdersSnapshot : toInt(row.liveCancelledOrdersCount);
  const totalOrdersCount = isClosed ? row.totalOrdersSnapshot : toInt(row.liveTotalOrdersCount);

  return {
    id: row.id,
    number: row.number,
    displayNumber: formatShiftNumber(row.number),
    businessDate: toBusinessDate(row.businessDate, row.timeZone),
    status: row.status,
    timeZone: row.timeZone,
    openedAt: row.openedAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
    responsibleName: row.responsibleName,
    closedByName: row.closedByName,
    openedByUserId: row.openedByUserId,
    closedByUserId: row.closedByUserId,
    activeOrdersCount: toInt(row.activeOrdersCount),
    checksCount: checksCount ?? 0,
    revenueCents: revenueCents ?? 0,
    cancelledOrdersCount: cancelledOrdersCount ?? 0,
    totalOrdersCount: totalOrdersCount ?? 0,
  };
}

function shiftSelectSql(extraWhere: string) {
  return `
    SELECT
      s."id",
      s."number",
      s."businessDate",
      s."status",
      s."timeZone",
      s."openedAt",
      s."closedAt",
      s."responsibleName",
      s."closedByName",
      s."openedByUserId",
      s."closedByUserId",
      s."checksCountSnapshot",
      s."revenueCentsSnapshot",
      s."cancelledOrdersSnapshot",
      s."totalOrdersSnapshot",
      COUNT(o."id") FILTER (WHERE o."status" IN (${ACTIVE_STATUS_SQL})) AS "activeOrdersCount",
      COUNT(o."id") FILTER (WHERE o."status" = 'DELIVERED_PAID') AS "liveChecksCount",
      COALESCE(SUM(o."totalCents") FILTER (WHERE o."status" = 'DELIVERED_PAID'), 0) AS "liveRevenueCents",
      COUNT(o."id") FILTER (WHERE o."status" = 'CANCELLED') AS "liveCancelledOrdersCount",
      COUNT(o."id") AS "liveTotalOrdersCount"
    FROM "DispatcherShift" s
    LEFT JOIN "Order" o ON o."shiftId" = s."id"
    ${extraWhere}
    GROUP BY s."id"
  `;
}

export async function getOpenShift(client: Queryable = pool) {
  const result = await client.query<ShiftRow>(
    `${shiftSelectSql(`WHERE s."status" = 'OPEN'`)} ORDER BY s."openedAt" ASC LIMIT 1`,
  );

  return result.rows[0] ? mapShiftRow(result.rows[0]) : null;
}

export async function getOpenShiftForUpdate(client: PoolClient) {
  const result = await client.query<ShiftRow>(
    `
      WITH locked AS (
        SELECT *
        FROM "DispatcherShift"
        WHERE "status" = 'OPEN'
        ORDER BY "openedAt" ASC
        LIMIT 1
        FOR UPDATE
      )
      ${shiftSelectSql(`WHERE s."id" IN (SELECT "id" FROM locked)`)}
    `,
  );

  return result.rows[0] ? mapShiftRow(result.rows[0]) : null;
}

export async function getShiftByBusinessDate(businessDate: string, client: Queryable = pool) {
  const result = await client.query<ShiftRow>(
    `${shiftSelectSql(`WHERE s."businessDate" = $1`)} LIMIT 1`,
    [getBusinessDateUtc(businessDate, BUSINESS_TIME_ZONE)],
  );

  return result.rows[0] ? mapShiftRow(result.rows[0]) : null;
}

export async function getShiftById(shiftId: number, client: Queryable = pool) {
  const result = await client.query<ShiftRow>(
    `${shiftSelectSql(`WHERE s."id" = $1`)} LIMIT 1`,
    [shiftId],
  );

  return result.rows[0] ? mapShiftRow(result.rows[0]) : null;
}

export async function lockShiftById(shiftId: number, client: PoolClient) {
  const lock = await client.query<{ id: number }>(
    `SELECT "id" FROM "DispatcherShift" WHERE "id" = $1 FOR UPDATE`,
    [shiftId],
  );

  if (!lock.rowCount) {
    return null;
  }

  return getShiftById(shiftId, client);
}

export async function createShift(input: {
  businessDate: string;
  now: Date;
  responsibleName: string;
  openedByUserId: number;
  client: PoolClient;
}) {
  const result = await input.client.query<ShiftRow>(
    `
      INSERT INTO "DispatcherShift" (
        "number",
        "businessDate",
        "status",
        "timeZone",
        "openedAt",
        "responsibleName",
        "openedByUserId"
      )
      VALUES (
        COALESCE((SELECT MAX("number") FROM "DispatcherShift"), 0) + 1,
        $1,
        'OPEN',
        $2,
        $3,
        $4,
        $5
      )
      RETURNING
        "id",
        "number",
        "businessDate",
        "status",
        "timeZone",
        "openedAt",
        "closedAt",
        "responsibleName",
        "closedByName",
        "openedByUserId",
        "closedByUserId",
        "checksCountSnapshot",
        "revenueCentsSnapshot",
        "cancelledOrdersSnapshot",
        "totalOrdersSnapshot",
        0 AS "activeOrdersCount",
        0 AS "liveChecksCount",
        0 AS "liveRevenueCents",
        0 AS "liveCancelledOrdersCount",
        0 AS "liveTotalOrdersCount"
    `,
    [
      getBusinessDateUtc(input.businessDate, BUSINESS_TIME_ZONE),
      BUSINESS_TIME_ZONE,
      input.now,
      input.responsibleName,
      input.openedByUserId,
    ],
  );

  return mapShiftRow(result.rows[0]);
}

export async function calculateShiftMetrics(shiftId: number, client: Queryable = pool): Promise<ShiftMetrics> {
  const result = await client.query<{
    activeOrdersCount: string;
    checksCount: string;
    revenueCents: string;
    cancelledOrdersCount: string;
    totalOrdersCount: string;
  }>(
    `
      SELECT
        COUNT("id") FILTER (WHERE "status" IN (${ACTIVE_STATUS_SQL})) AS "activeOrdersCount",
        COUNT("id") FILTER (WHERE "status" = 'DELIVERED_PAID') AS "checksCount",
        COALESCE(SUM("totalCents") FILTER (WHERE "status" = 'DELIVERED_PAID'), 0) AS "revenueCents",
        COUNT("id") FILTER (WHERE "status" = 'CANCELLED') AS "cancelledOrdersCount",
        COUNT("id") AS "totalOrdersCount"
      FROM "Order"
      WHERE "shiftId" = $1
    `,
    [shiftId],
  );
  const row = result.rows[0];

  return {
    activeOrdersCount: toInt(row?.activeOrdersCount),
    checksCount: toInt(row?.checksCount),
    revenueCents: toInt(row?.revenueCents),
    cancelledOrdersCount: toInt(row?.cancelledOrdersCount),
    totalOrdersCount: toInt(row?.totalOrdersCount),
  };
}

export async function closeShift(input: {
  shiftId: number;
  now: Date;
  closedByName: string;
  closedByUserId: number;
  metrics: ShiftMetrics;
  client: PoolClient;
}) {
  await input.client.query(
    `
      UPDATE "DispatcherShift"
      SET
        "status" = 'CLOSED',
        "closedAt" = $2,
        "closedByName" = $3,
        "closedByUserId" = $4,
        "checksCountSnapshot" = $5,
        "revenueCentsSnapshot" = $6,
        "cancelledOrdersSnapshot" = $7,
        "totalOrdersSnapshot" = $8,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $1
    `,
    [
      input.shiftId,
      input.now,
      input.closedByName,
      input.closedByUserId,
      input.metrics.checksCount,
      input.metrics.revenueCents,
      input.metrics.cancelledOrdersCount,
      input.metrics.totalOrdersCount,
    ],
  );

  return getShiftById(input.shiftId, input.client);
}

export async function getShiftOrders(shiftId: number, client: Queryable = pool) {
  const result = await client.query<OrderRow>(
    `
      SELECT
        o."id",
        o."status",
        o."shiftId",
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
      WHERE o."shiftId" = $1
      ORDER BY o."createdAt" DESC, o."id" DESC
      LIMIT 150
    `,
    [shiftId],
  );

  return attachItemsToOrders(result.rows.map(mapRowToOrder));
}

export async function listShifts(input: { limit: number; status?: DispatcherShiftStatus }) {
  const values: unknown[] = [];
  const where = input.status ? `WHERE s."status" = $${values.push(input.status)}` : "";
  const result = await pool.query<ShiftRow>(
    `${shiftSelectSql(where)} ORDER BY s."businessDate" DESC, s."number" DESC LIMIT $${values.push(input.limit)}`,
    values,
  );

  return result.rows.map(mapShiftRow);
}

export function groupDispatcherOrders(orders: OrderListItem[]) {
  return {
    new: orders.filter((order) => order.status === "NEW"),
    inProgress: orders.filter((order) =>
      order.status !== "NEW" && ACTIVE_ORDER_STATUSES.includes(order.status),
    ),
    completed: orders.filter((order) => order.status === "DELIVERED_PAID" || order.status === "CANCELLED").slice(0, 50),
  };
}

export async function resolveCurrentOpenShiftForOrderCreate(client: PoolClient, now: Date) {
  const shift = await getOpenShiftForUpdate(client);

  if (!shift || shift.status !== "OPEN") {
    return null;
  }

  return shift.businessDate === toBusinessDate(now, shift.timeZone) ? shift : null;
}
