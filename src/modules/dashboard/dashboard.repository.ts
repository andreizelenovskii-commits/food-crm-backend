import { pool } from "@backend/shared/db/pool";

export type DashboardAggregateData = {
  entityCounts: {
    orders: number;
    clients: number;
    products: number;
    employees: number;
  };
  totalRevenueCents: number;
  averageOrderCents: number;
  completedOrders: number;
  completedRevenueCents: number;
  monthOrders: number;
  monthRevenueCents: number;
};

export type EmployeeDashboardSource = {
  role: string;
  schedule: unknown;
  totals: Record<string, number>;
};

export async function getDashboardAggregateData(): Promise<DashboardAggregateData> {
  const [
    ordersCountResult,
    clientsCountResult,
    productsCountResult,
    employeesCountResult,
    orderTotalsResult,
    completedSalesResult,
    monthSalesResult,
  ] = await Promise.all([
    pool.query<{ count: string }>(`SELECT COUNT(*) AS count FROM "Order"`),
    pool.query<{ count: string }>(`SELECT COUNT(*) AS count FROM "Client"`),
    pool.query<{ count: string }>(`SELECT COUNT(*) AS count FROM "Product"`),
    pool.query<{ count: string }>(`SELECT COUNT(*) AS count FROM "Employee"`),
    pool.query<{ total_cents: string | null; average_cents: string | null }>(`
      SELECT
        COALESCE(SUM("totalCents"), 0) AS total_cents,
        COALESCE(AVG("totalCents"), 0) AS average_cents
      FROM "Order"
    `),
    pool.query<{ completed_count: string; completed_total_cents: string | null }>(`
      SELECT
        COUNT(*) AS completed_count,
        COALESCE(SUM("totalCents"), 0) AS completed_total_cents
      FROM "Order"
      WHERE "status"::text IN ('COMPLETED', 'DELIVERED_PAID')
    `),
    pool.query<{ month_count: string; month_total_cents: string | null }>(`
      SELECT
        COUNT(*) AS month_count,
        COALESCE(SUM("totalCents"), 0) AS month_total_cents
      FROM "Order"
      WHERE date_trunc('month', "createdAt") = date_trunc('month', CURRENT_DATE)
    `),
  ]);

  return {
    entityCounts: {
      orders: Number(ordersCountResult.rows[0]?.count ?? 0),
      clients: Number(clientsCountResult.rows[0]?.count ?? 0),
      products: Number(productsCountResult.rows[0]?.count ?? 0),
      employees: Number(employeesCountResult.rows[0]?.count ?? 0),
    },
    totalRevenueCents: Number(orderTotalsResult.rows[0]?.total_cents ?? 0),
    averageOrderCents: Math.round(Number(orderTotalsResult.rows[0]?.average_cents ?? 0)),
    completedOrders: Number(completedSalesResult.rows[0]?.completed_count ?? 0),
    completedRevenueCents: Number(completedSalesResult.rows[0]?.completed_total_cents ?? 0),
    monthOrders: Number(monthSalesResult.rows[0]?.month_count ?? 0),
    monthRevenueCents: Number(monthSalesResult.rows[0]?.month_total_cents ?? 0),
  };
}

export async function getEmployeeDashboardSourceByEmail(
  email: string,
  monthStart: string,
  monthEnd: string,
): Promise<EmployeeDashboardSource | null> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  const employeeResult = await pool.query<{
    id: number;
    role: string;
    schedule: unknown;
  }>(
    `
      SELECT "id", "role", "schedule"
      FROM "Employee"
      WHERE LOWER("email") = $1
      LIMIT 1
    `,
    [normalizedEmail],
  );

  const employee = employeeResult.rows[0];

  if (!employee) {
    return null;
  }

  const monthTotalsResult = await pool.query<{
    type: string;
    total: string;
  }>(
    `
      SELECT "type", COALESCE(SUM("amountCents"), 0) AS total
      FROM "EmployeeAdjustment"
      WHERE "employeeId" = $1
        AND "createdAt" >= $2::date
        AND "createdAt" < $3::date
      GROUP BY "type"
    `,
    [employee.id, monthStart, monthEnd],
  );

  const totals = monthTotalsResult.rows.reduce(
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

  return {
    role: employee.role,
    schedule: employee.schedule,
    totals,
  };
}
