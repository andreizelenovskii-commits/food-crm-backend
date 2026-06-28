import { pool } from "@backend/shared/db/pool";
import { ensureRecentDatabaseBackup } from "@backend/shared/db/backup";
import { BUSINESS_TIME_ZONE, getBusinessDateUtc, toBusinessDate } from "@backend/modules/dispatcher-shifts/dispatcher-shifts.time";
import type {
  ManagementAccountingEntryType,
  ManagementAccountingManualEntry,
} from "@backend/modules/management-accounting/management-accounting.types";

type ManualEntryRow = {
  id: number;
  businessDate: Date;
  type: ManagementAccountingEntryType;
  category: string;
  amountCents: number;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DailyEmployeeRow = {
  employeeId: number;
  name: string;
  role: string;
  schedule: unknown;
  ordersCount: string;
  revenueCents: string | null;
  advancesCents: string | null;
  finesCents: string | null;
  debtCents: string | null;
};

function mapManualEntry(row: ManualEntryRow): ManagementAccountingManualEntry {
  return {
    id: row.id,
    date: toBusinessDate(row.businessDate, BUSINESS_TIME_ZONE),
    type: row.type,
    category: row.category,
    amountCents: row.amountCents,
    amount: String(row.amountCents / 100),
    comment: row.comment,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getManagementAccountingManualEntries(date: string) {
  const result = await pool.query<ManualEntryRow>(
    `
      SELECT
        "id",
        "businessDate",
        "type",
        "category",
        "amountCents",
        "comment",
        "createdAt",
        "updatedAt"
      FROM "ManagementAccountingEntry"
      WHERE "businessDate" = $1
      ORDER BY "type" ASC, "category" ASC, "createdAt" ASC
    `,
    [getBusinessDateUtc(date, BUSINESS_TIME_ZONE)],
  );

  return result.rows.map(mapManualEntry);
}

export async function createManagementAccountingManualEntry(input: {
  date: string;
  type: ManagementAccountingEntryType;
  category: string;
  amountCents: number;
  comment: string | null;
  createdByUserId: number | null;
}) {
  await ensureRecentDatabaseBackup("management-accounting-entry-create");
  const result = await pool.query<ManualEntryRow>(
    `
      INSERT INTO "ManagementAccountingEntry" (
        "businessDate",
        "type",
        "category",
        "amountCents",
        "comment",
        "createdByUserId"
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        "id",
        "businessDate",
        "type",
        "category",
        "amountCents",
        "comment",
        "createdAt",
        "updatedAt"
    `,
    [
      getBusinessDateUtc(input.date, BUSINESS_TIME_ZONE),
      input.type,
      input.category,
      input.amountCents,
      input.comment,
      input.createdByUserId,
    ],
  );

  return mapManualEntry(result.rows[0]);
}

export async function updateManagementAccountingManualEntry(input: {
  entryId: number;
  type: ManagementAccountingEntryType;
  category: string;
  amountCents: number;
  comment: string | null;
}) {
  await ensureRecentDatabaseBackup("management-accounting-entry-update");
  const result = await pool.query<ManualEntryRow>(
    `
      UPDATE "ManagementAccountingEntry"
      SET
        "type" = $2,
        "category" = $3,
        "amountCents" = $4,
        "comment" = $5,
        "updatedAt" = NOW()
      WHERE "id" = $1
      RETURNING
        "id",
        "businessDate",
        "type",
        "category",
        "amountCents",
        "comment",
        "createdAt",
        "updatedAt"
    `,
    [input.entryId, input.type, input.category, input.amountCents, input.comment],
  );

  return result.rows[0] ? mapManualEntry(result.rows[0]) : null;
}

export async function deleteManagementAccountingManualEntry(entryId: number) {
  await ensureRecentDatabaseBackup("management-accounting-entry-delete");
  const result = await pool.query<{ id: number }>(
    `DELETE FROM "ManagementAccountingEntry" WHERE "id" = $1 RETURNING "id"`,
    [entryId],
  );

  return Boolean(result.rowCount);
}

export async function getDailyEmployeeRows(input: { start: string; end: string }) {
  const result = await pool.query<DailyEmployeeRow>(
    `
      WITH order_totals AS (
        SELECT
          "employeeId",
          COUNT("id") FILTER (WHERE "status" = 'DELIVERED_PAID') AS "ordersCount",
          COALESCE(SUM("totalCents") FILTER (WHERE "status" = 'DELIVERED_PAID'), 0) AS "revenueCents"
        FROM "Order"
        WHERE "createdAt" >= $1::timestamptz
          AND "createdAt" < $2::timestamptz
        GROUP BY "employeeId"
      ),
      adjustment_totals AS (
        SELECT
          "employeeId",
          COALESCE(SUM("amountCents") FILTER (WHERE "type" = 'ADVANCE'), 0) AS "advancesCents",
          COALESCE(SUM("amountCents") FILTER (WHERE "type" = 'FINE'), 0) AS "finesCents",
          COALESCE(SUM("amountCents") FILTER (WHERE "type" = 'DEBT'), 0) AS "debtCents"
        FROM "EmployeeAdjustment"
        WHERE "createdAt" >= $1::timestamptz
          AND "createdAt" < $2::timestamptz
        GROUP BY "employeeId"
      )
      SELECT
        e."id" AS "employeeId",
        e."name",
        e."role",
        e."schedule",
        COALESCE(o."ordersCount", 0) AS "ordersCount",
        COALESCE(o."revenueCents", 0) AS "revenueCents",
        COALESCE(a."advancesCents", 0) AS "advancesCents",
        COALESCE(a."finesCents", 0) AS "finesCents",
        COALESCE(a."debtCents", 0) AS "debtCents"
      FROM "Employee" e
      LEFT JOIN order_totals o ON o."employeeId" = e."id"
      LEFT JOIN adjustment_totals a ON a."employeeId" = e."id"
      ORDER BY e."role" ASC, e."name" ASC
    `,
    [input.start, input.end],
  );

  return result.rows;
}
