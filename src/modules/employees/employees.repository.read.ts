import { pool } from "@backend/shared/db/pool";
import { ensureRecentDatabaseBackup } from "@backend/shared/db/backup";
import type { Employee, EmployeeAdjustment, EmployeeMonthlyOrderStat } from "@backend/modules/employees/employees.types";
import {
  mapRowToAdjustment,
  mapRowToEmployee,
  type EmployeeRow,
} from "@backend/modules/employees/employees.repository.shared";

export async function getAllEmployees(): Promise<Employee[]> {
  const result = await pool.query<EmployeeRow>(
    `
      SELECT
        e."id",
        e."name",
        e."email",
        e."role",
        e."phone",
        e."messenger",
        e."schedule",
        e."monthlyHours",
        e."birthDate",
        e."hireDate",
        e."createdAt",
        COUNT(o."id") AS "ordersCount"
      FROM "Employee" e
      LEFT JOIN "Order" o ON o."employeeId" = e."id"
      GROUP BY
        e."id",
        e."name",
        e."email",
        e."role",
        e."phone",
        e."messenger",
        e."schedule",
        e."monthlyHours",
        e."birthDate",
        e."hireDate",
        e."createdAt"
      ORDER BY e."createdAt" DESC
    `,
  );

  return result.rows.map(mapRowToEmployee);
}

export async function getEmployeeById(employeeId: number): Promise<Employee | null> {
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    return null;
  }

  const result = await pool.query<EmployeeRow>(
    `
      SELECT "id", "name", "email", "role", "phone", "messenger", "schedule", "monthlyHours", "birthDate", "hireDate", "createdAt"
      FROM "Employee"
      WHERE "id" = $1
      LIMIT 1
    `,
    [employeeId],
  );

  if (!result.rowCount) {
    return null;
  }

  return mapRowToEmployee(result.rows[0]);
}

export async function getEmployeeAdjustments(
  employeeId: number,
): Promise<EmployeeAdjustment[]> {
  const result = await pool.query<{
    id: number;
    employeeId: number;
    type: string;
    amountCents: number;
    comment: string | null;
    createdAt: Date;
  }>(
    `
      SELECT "id", "employeeId", "type", "amountCents", "comment", "createdAt"
      FROM "EmployeeAdjustment"
      WHERE "employeeId" = $1
      ORDER BY "createdAt" DESC
    `,
    [employeeId],
  );

  return result.rows.map(mapRowToAdjustment);
}

export async function getEmployeeAdjustmentTotals(employeeId: number) {
  const result = await pool.query<{
    type: string;
    total: string;
  }>(
    `
      SELECT "type", SUM("amountCents") AS total
      FROM "EmployeeAdjustment"
      WHERE "employeeId" = $1
      GROUP BY "type"
    `,
    [employeeId],
  );

  return result.rows.reduce(
    (acc, row) => ({
      ...acc,
      [row.type]: Number(row.total ?? 0),
    }),
    {
      ADVANCE: 0,
      FINE: 0,
      DEBT: 0,
    } as Record<string, number>,
  );
}

export async function getEmployeeOrdersThisMonth(employeeId: number): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `
      SELECT COUNT(*) AS count
      FROM "Order"
      WHERE "employeeId" = $1
        AND "createdAt" >= date_trunc('month', CURRENT_DATE)
        AND "createdAt" < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
    `,
    [employeeId],
  );

  return Number(result.rows[0]?.count ?? 0);
}

export async function getEmployeeOrderMonthlyStats(employeeId: number): Promise<EmployeeMonthlyOrderStat[]> {
  const result = await pool.query<{
    monthKey: string;
    ordersCount: string;
    revenueCents: string;
  }>(
    `
      SELECT
        TO_CHAR(date_trunc('month', "createdAt"), 'YYYY-MM') AS "monthKey",
        COUNT(*) AS "ordersCount",
        COALESCE(SUM("totalCents"), 0) AS "revenueCents"
      FROM "Order"
      WHERE "employeeId" = $1
      GROUP BY date_trunc('month', "createdAt")
      ORDER BY date_trunc('month', "createdAt") DESC
    `,
    [employeeId],
  );

  return result.rows.map((row) => ({
    monthKey: row.monthKey,
    ordersCount: Number(row.ordersCount ?? 0),
    revenueCents: Number(row.revenueCents ?? 0),
  }));
}

export async function createEmployeeAdjustment(input: {
  employeeId: number;
  type: string;
  amountCents: number;
  comment: string | null;
  date: string;
}): Promise<EmployeeAdjustment> {
  await ensureRecentDatabaseBackup("employee-adjustment-create");
  const result = await pool.query<{
    id: number;
    employeeId: number;
    type: string;
    amountCents: number;
    comment: string | null;
    createdAt: Date;
  }>(
    `
      INSERT INTO "EmployeeAdjustment" ("employeeId", "type", "amountCents", "comment", "createdAt")
      VALUES ($1, $2, $3, $4, $5)
      RETURNING "id", "employeeId", "type", "amountCents", "comment", "createdAt"
    `,
    [input.employeeId, input.type, input.amountCents, input.comment, input.date],
  );

  return mapRowToAdjustment(result.rows[0]);
}
