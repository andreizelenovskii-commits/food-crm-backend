import { pool } from "@backend/shared/db/pool";
import type { QueryResultRow } from "pg";

export type SalesAnalyticsRangeInput = {
  start: string;
  end: string;
  lookbackStart: string;
};

export type OrderTotalsRow = {
  period_orders_count: string;
  completed_count: string;
  cancelled_count: string;
  active_count: string;
  revenue_cents: string | null;
  subtotal_cents: string | null;
  active_value_cents: string | null;
};

export type FlowRow = {
  label: string;
  value_cents: string | null;
};

export type ProfitabilityRow = {
  estimated_cogs_cents: string | null;
};

export type MenuPerformanceRow = {
  label: string;
  quantity: string;
  revenue_cents: string | null;
  cost_cents: string | null;
};

export type InventoryTotalsRow = {
  products_count: string;
  stock_value_cents: string | null;
  tech_cards_count: string;
  catalog_items_count: string;
  linked_catalog_items_count: string;
};

export type ActTotalsRow = {
  incoming_count: string;
  incoming_total_cents: string | null;
  writeoff_count: string;
  writeoff_total_cents: string | null;
};

export type ForecastRow = {
  last30_count: string;
  last30_revenue_cents: string | null;
  previous30_revenue_cents: string | null;
  cancelled_count: string;
  total_count: string;
  subtotal_cents: string | null;
  revenue_cents: string | null;
};

export type SalesAnalyticsRepositoryTiming = {
  name: string;
  durationMs: number;
  rows: number;
};

export type SalesAnalyticsRepositoryData = {
  orderTotals: OrderTotalsRow;
  sourceFlow: FlowRow[];
  revenueByCategory: FlowRow[];
  profitability: ProfitabilityRow;
  menuPerformance: MenuPerformanceRow[];
  inventoryTotals: InventoryTotalsRow;
  actTotals: ActTotalsRow;
  forecast: ForecastRow;
  rows: Record<string, number>;
  timings: SalesAnalyticsRepositoryTiming[];
};

export type SalesAnalyticsQueryDefinition<Row extends QueryResultRow> = {
  name: keyof Omit<SalesAnalyticsRepositoryData, "rows" | "timings">;
  sql: string;
  values: (input: SalesAnalyticsRangeInput) => unknown[];
  fallback: Row;
};

export const salesAnalyticsQueryDefinitions = {
  orderTotals: {
    name: "orderTotals",
    sql: `
      SELECT
        COUNT(*) AS period_orders_count,
        COUNT(*) FILTER (WHERE "status" = 'DELIVERED_PAID') AS completed_count,
        COUNT(*) FILTER (WHERE "status" = 'CANCELLED') AS cancelled_count,
        COUNT(*) FILTER (WHERE "status" IN ('SENT_TO_KITCHEN', 'READY', 'PACKED')) AS active_count,
        COALESCE(SUM("totalCents") FILTER (WHERE "status" = 'DELIVERED_PAID'), 0) AS revenue_cents,
        COALESCE(SUM("subtotalCents") FILTER (WHERE "status" = 'DELIVERED_PAID'), 0) AS subtotal_cents,
        COALESCE(SUM("totalCents") FILTER (WHERE "status" IN ('SENT_TO_KITCHEN', 'READY', 'PACKED')), 0) AS active_value_cents
      FROM "Order"
      WHERE "createdAt" >= $1::timestamptz
        AND "createdAt" < $2::timestamptz
    `,
    values: ({ start, end }) => [start, end],
    fallback: {
      period_orders_count: "0",
      completed_count: "0",
      cancelled_count: "0",
      active_count: "0",
      revenue_cents: "0",
      subtotal_cents: "0",
      active_value_cents: "0",
    },
  } satisfies SalesAnalyticsQueryDefinition<OrderTotalsRow>,
  sourceFlow: {
    name: "sourceFlow",
    sql: `
      SELECT "source" AS label, COALESCE(SUM("totalCents"), 0) AS value_cents
      FROM "Order"
      WHERE "createdAt" >= $1::timestamptz
        AND "createdAt" < $2::timestamptz
        AND "status" = 'DELIVERED_PAID'
      GROUP BY "source"
      ORDER BY value_cents DESC
    `,
    values: ({ start, end }) => [start, end],
    fallback: { label: "", value_cents: "0" },
  } satisfies SalesAnalyticsQueryDefinition<FlowRow>,
  revenueByCategory: {
    name: "revenueByCategory",
    sql: `
      SELECT COALESCE(ci."category", 'Без категории') AS label,
        COALESCE(SUM(oi."totalPriceCents"), 0) AS value_cents
      FROM "OrderItem" oi
      INNER JOIN "Order" o ON o."id" = oi."orderId"
      LEFT JOIN "CatalogItem" ci ON ci."id" = oi."catalogItemId"
      WHERE o."createdAt" >= $1::timestamptz
        AND o."createdAt" < $2::timestamptz
        AND o."status" = 'DELIVERED_PAID'
      GROUP BY COALESCE(ci."category", 'Без категории')
      ORDER BY value_cents DESC
      LIMIT 8
    `,
    values: ({ start, end }) => [start, end],
    fallback: { label: "", value_cents: "0" },
  } satisfies SalesAnalyticsQueryDefinition<FlowRow>,
  profitability: {
    name: "profitability",
    sql: `
      WITH card_cost AS (
        SELECT
          tc."id" AS tech_card_id,
          COALESCE(SUM(tci."quantity" * p."priceCents"), 0) / GREATEST(tc."outputQuantity", 1) AS unit_cost_cents
        FROM "TechnologicalCard" tc
        LEFT JOIN "TechCardIngredient" tci ON tci."technologicalCardId" = tc."id"
        LEFT JOIN "Product" p ON p."id" = tci."productId"
        GROUP BY tc."id", tc."outputQuantity"
      )
      SELECT COALESCE(SUM(oi."quantity" * COALESCE(cc.unit_cost_cents, 0)), 0) AS estimated_cogs_cents
      FROM "OrderItem" oi
      INNER JOIN "Order" o ON o."id" = oi."orderId"
      LEFT JOIN "CatalogItem" ci ON ci."id" = oi."catalogItemId"
      LEFT JOIN "CatalogItemVariant" civ ON civ."id" = oi."catalogItemVariantId"
      LEFT JOIN card_cost cc ON cc.tech_card_id = COALESCE(civ."technologicalCardId", ci."technologicalCardId")
      WHERE o."createdAt" >= $1::timestamptz
        AND o."createdAt" < $2::timestamptz
        AND o."status" = 'DELIVERED_PAID'
    `,
    values: ({ start, end }) => [start, end],
    fallback: { estimated_cogs_cents: "0" },
  } satisfies SalesAnalyticsQueryDefinition<ProfitabilityRow>,
  menuPerformance: {
    name: "menuPerformance",
    sql: `
      WITH card_cost AS (
        SELECT
          tc."id" AS tech_card_id,
          COALESCE(SUM(tci."quantity" * p."priceCents"), 0) / GREATEST(tc."outputQuantity", 1) AS unit_cost_cents
        FROM "TechnologicalCard" tc
        LEFT JOIN "TechCardIngredient" tci ON tci."technologicalCardId" = tc."id"
        LEFT JOIN "Product" p ON p."id" = tci."productId"
        GROUP BY tc."id", tc."outputQuantity"
      )
      SELECT
        oi."itemName" AS label,
        COALESCE(SUM(oi."quantity"), 0) AS quantity,
        COALESCE(SUM(oi."totalPriceCents"), 0) AS revenue_cents,
        COALESCE(SUM(oi."quantity" * COALESCE(cc.unit_cost_cents, 0)), 0) AS cost_cents
      FROM "OrderItem" oi
      INNER JOIN "Order" o ON o."id" = oi."orderId"
      LEFT JOIN "CatalogItem" ci ON ci."id" = oi."catalogItemId"
      LEFT JOIN "CatalogItemVariant" civ ON civ."id" = oi."catalogItemVariantId"
      LEFT JOIN card_cost cc ON cc.tech_card_id = COALESCE(civ."technologicalCardId", ci."technologicalCardId")
      WHERE o."createdAt" >= $1::timestamptz
        AND o."createdAt" < $2::timestamptz
        AND o."status" = 'DELIVERED_PAID'
      GROUP BY oi."itemName"
      ORDER BY COALESCE(SUM(oi."totalPriceCents"), 0) - COALESCE(SUM(oi."quantity" * COALESCE(cc.unit_cost_cents, 0)), 0) DESC
      LIMIT 8
    `,
    values: ({ start, end }) => [start, end],
    fallback: { label: "", quantity: "0", revenue_cents: "0", cost_cents: "0" },
  } satisfies SalesAnalyticsQueryDefinition<MenuPerformanceRow>,
  inventoryTotals: {
    name: "inventoryTotals",
    sql: `
      SELECT
        (SELECT COUNT(*) FROM "Product") AS products_count,
        (SELECT COALESCE(SUM("stockQuantity" * "priceCents"), 0) FROM "Product") AS stock_value_cents,
        (SELECT COUNT(*) FROM "TechnologicalCard") AS tech_cards_count,
        (SELECT COUNT(*) FROM "CatalogItem") AS catalog_items_count,
        (
          SELECT COUNT(*)
          FROM "CatalogItem" ci
          WHERE ci."technologicalCardId" IS NOT NULL
            OR EXISTS (
              SELECT 1
              FROM "CatalogItemVariant" civ
              WHERE civ."catalogItemId" = ci."id"
                AND civ."technologicalCardId" IS NOT NULL
            )
        ) AS linked_catalog_items_count
    `,
    values: () => [],
    fallback: {
      products_count: "0",
      stock_value_cents: "0",
      tech_cards_count: "0",
      catalog_items_count: "0",
      linked_catalog_items_count: "0",
    },
  } satisfies SalesAnalyticsQueryDefinition<InventoryTotalsRow>,
  actTotals: {
    name: "actTotals",
    sql: `
      SELECT
        (
          SELECT COUNT(*)
          FROM "IncomingAct" a
          WHERE a."completedAt" IS NOT NULL
            AND a."completedAt" >= $1::timestamptz
            AND a."completedAt" < $2::timestamptz
        ) AS incoming_count,
        (
          SELECT COALESCE(SUM(i."quantity" * i."priceCents"), 0)
          FROM "IncomingActItem" i
          INNER JOIN "IncomingAct" a ON a."id" = i."incomingActId"
          WHERE a."completedAt" IS NOT NULL
            AND a."completedAt" >= $1::timestamptz
            AND a."completedAt" < $2::timestamptz
        ) AS incoming_total_cents,
        (
          SELECT COUNT(*)
          FROM "WriteoffAct" a
          WHERE a."completedAt" IS NOT NULL
            AND a."completedAt" >= $1::timestamptz
            AND a."completedAt" < $2::timestamptz
        ) AS writeoff_count,
        (
          SELECT COALESCE(SUM(i."quantity" * i."priceCents"), 0)
          FROM "WriteoffActItem" i
          INNER JOIN "WriteoffAct" a ON a."id" = i."writeoffActId"
          WHERE a."completedAt" IS NOT NULL
            AND a."completedAt" >= $1::timestamptz
            AND a."completedAt" < $2::timestamptz
        ) AS writeoff_total_cents
    `,
    values: ({ start, end }) => [start, end],
    fallback: {
      incoming_count: "0",
      incoming_total_cents: "0",
      writeoff_count: "0",
      writeoff_total_cents: "0",
    },
  } satisfies SalesAnalyticsQueryDefinition<ActTotalsRow>,
  forecast: {
    name: "forecast",
    sql: `
      SELECT
        COUNT(*) FILTER (
          WHERE "status" = 'DELIVERED_PAID'
            AND "createdAt" >= ($2::timestamptz - INTERVAL '30 days')
        ) AS last30_count,
        COALESCE(SUM("totalCents") FILTER (
          WHERE "status" = 'DELIVERED_PAID'
            AND "createdAt" >= ($2::timestamptz - INTERVAL '30 days')
        ), 0) AS last30_revenue_cents,
        COALESCE(SUM("totalCents") FILTER (
          WHERE "status" = 'DELIVERED_PAID'
            AND "createdAt" >= $1::timestamptz
            AND "createdAt" < ($2::timestamptz - INTERVAL '30 days')
        ), 0) AS previous30_revenue_cents,
        COUNT(*) FILTER (WHERE "status" = 'CANCELLED') AS cancelled_count,
        COUNT(*) AS total_count,
        COALESCE(SUM("subtotalCents") FILTER (WHERE "status" = 'DELIVERED_PAID'), 0) AS subtotal_cents,
        COALESCE(SUM("totalCents") FILTER (WHERE "status" = 'DELIVERED_PAID'), 0) AS revenue_cents
      FROM "Order"
      WHERE "createdAt" >= $1::timestamptz
        AND "createdAt" < $2::timestamptz
    `,
    values: ({ lookbackStart, end }) => [lookbackStart, end],
    fallback: {
      last30_count: "0",
      last30_revenue_cents: "0",
      previous30_revenue_cents: "0",
      cancelled_count: "0",
      total_count: "0",
      subtotal_cents: "0",
      revenue_cents: "0",
    },
  } satisfies SalesAnalyticsQueryDefinition<ForecastRow>,
};

async function timedQuery<Row extends QueryResultRow>(
  definition: SalesAnalyticsQueryDefinition<Row>,
  input: SalesAnalyticsRangeInput,
): Promise<{ rows: Row[]; rowCount: number; timing: SalesAnalyticsRepositoryTiming }> {
  const startedAt = performance.now();
  const result = await pool.query<Row>(definition.sql, definition.values(input));

  return {
    rows: result.rows,
    rowCount: result.rowCount ?? 0,
    timing: {
      name: definition.name,
      durationMs: Math.round(performance.now() - startedAt),
      rows: result.rowCount ?? 0,
    },
  };
}

export async function getSalesAnalyticsRepositoryData(input: SalesAnalyticsRangeInput): Promise<SalesAnalyticsRepositoryData> {
  const [
    orderTotalsResult,
    sourceFlowResult,
    revenueByCategoryResult,
    profitabilityResult,
    menuPerformanceResult,
    inventoryTotalsResult,
    actTotalsResult,
    forecastResult,
  ] = await Promise.all([
    timedQuery(salesAnalyticsQueryDefinitions.orderTotals, input),
    timedQuery(salesAnalyticsQueryDefinitions.sourceFlow, input),
    timedQuery(salesAnalyticsQueryDefinitions.revenueByCategory, input),
    timedQuery(salesAnalyticsQueryDefinitions.profitability, input),
    timedQuery(salesAnalyticsQueryDefinitions.menuPerformance, input),
    timedQuery(salesAnalyticsQueryDefinitions.inventoryTotals, input),
    timedQuery(salesAnalyticsQueryDefinitions.actTotals, input),
    timedQuery(salesAnalyticsQueryDefinitions.forecast, input),
  ]);
  const timings = [
    orderTotalsResult.timing,
    sourceFlowResult.timing,
    revenueByCategoryResult.timing,
    profitabilityResult.timing,
    menuPerformanceResult.timing,
    inventoryTotalsResult.timing,
    actTotalsResult.timing,
    forecastResult.timing,
  ];

  return {
    orderTotals: orderTotalsResult.rows[0] ?? salesAnalyticsQueryDefinitions.orderTotals.fallback,
    sourceFlow: sourceFlowResult.rows,
    revenueByCategory: revenueByCategoryResult.rows,
    profitability: profitabilityResult.rows[0] ?? salesAnalyticsQueryDefinitions.profitability.fallback,
    menuPerformance: menuPerformanceResult.rows,
    inventoryTotals: inventoryTotalsResult.rows[0] ?? salesAnalyticsQueryDefinitions.inventoryTotals.fallback,
    actTotals: actTotalsResult.rows[0] ?? salesAnalyticsQueryDefinitions.actTotals.fallback,
    forecast: forecastResult.rows[0] ?? salesAnalyticsQueryDefinitions.forecast.fallback,
    rows: Object.fromEntries(timings.map(({ name, rows }) => [name, rows])),
    timings,
  };
}
