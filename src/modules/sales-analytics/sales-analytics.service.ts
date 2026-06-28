import { hasApiPermission, type AuthenticatedApiUser } from "@backend/modules/access/access-control";
import {
  addDays,
  buildDateParts,
  buildPeriodOptions,
  buildSalesAnalyticsRange,
  buildSalesHref,
} from "@backend/modules/sales-analytics/sales-analytics.periods";
import {
  getSalesAnalyticsRepositoryData,
} from "@backend/modules/sales-analytics/sales-analytics.repository";
import type {
  SalesAnalyticsDto,
  SalesAnalyticsMetric,
  SalesAnalyticsPeriod,
  SalesAnalyticsRange,
} from "@backend/modules/sales-analytics/sales-analytics.types";

const MONEY_FORMATTER = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});
const NUMBER_FORMATTER = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
const HOLIDAY_DATES = new Set(["01-01", "01-02", "01-03", "01-07", "02-23", "03-08", "05-01", "05-09", "06-12", "11-04", "12-31"]);

function formatMoney(cents: number) {
  return MONEY_FORMATTER.format(cents / 100);
}

function formatNumber(value: number) {
  return NUMBER_FORMATTER.format(value);
}

function formatPercent(part: number, total: number) {
  return total ? `${NUMBER_FORMATTER.format((part / total) * 100)}%` : "0%";
}

function toNumber(value: string | number | null | undefined) {
  return Math.round(Number(value ?? 0));
}

function getCalendarDays(start: Date, end: Date) {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function countMonthDays(start: Date) {
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  let weekends = 0;
  let holidays = 0;

  for (let date = new Date(start); date < end; date = addDays(date, 1)) {
    const day = date.getDay();
    const holidayKey = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    weekends += day === 0 || day === 6 ? 1 : 0;
    holidays += HOLIDAY_DATES.has(holidayKey) ? 1 : 0;
  }

  return { days: getCalendarDays(start, end), weekends, holidays };
}

function buildForecast({
  range,
  last30Count,
  last30RevenueCents,
  previous30RevenueCents,
  cancelledCount,
  totalCount,
  subtotalCents,
  revenueCents,
}: {
  range: SalesAnalyticsRange;
  last30Count: number;
  last30RevenueCents: number;
  previous30RevenueCents: number;
  cancelledCount: number;
  totalCount: number;
  subtotalCents: number;
  revenueCents: number;
}) {
  const start = new Date(range.start);
  const nextMonthStart = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const averageCheckCents = last30Count ? last30RevenueCents / last30Count : 0;
  const baseDailyCents = last30RevenueCents / 30;
  const trend = previous30RevenueCents ? clamp(last30RevenueCents / previous30RevenueCents, 0.72, 1.35) : 1;
  const monthShape = countMonthDays(nextMonthStart);
  const cancellationRate = totalCount ? cancelledCount / totalCount : 0;
  const discountCents = Math.max(subtotalCents - revenueCents, 0);
  const discountRate = subtotalCents ? discountCents / subtotalCents : 0;
  const calendarFactor = 1 + (monthShape.weekends / monthShape.days) * 0.08 + monthShape.holidays * 0.12;
  const riskFactor = clamp(1 - cancellationRate * 0.16 - discountRate * 0.05, 0.82, 1.04);
  const forecastRevenueCents = Math.round(baseDailyCents * monthShape.days * trend * calendarFactor * riskFactor);
  const forecastOrders = averageCheckCents ? Math.round(forecastRevenueCents / averageCheckCents) : 0;
  const confidence = last30Count >= 80 ? "Высокая" : last30Count >= 25 ? "Средняя" : "Низкая";
  const label = nextMonthStart.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

  return {
    label,
    metrics: [
      { label: "Прогноз выручки", value: formatMoney(forecastRevenueCents), hint: `На ${label}` },
      { label: "Прогноз заказов", value: formatNumber(forecastOrders), hint: `Средний чек ${formatMoney(Math.round(averageCheckCents))}` },
      { label: "Средний день", value: formatMoney(Math.round(baseDailyCents * trend * calendarFactor * riskFactor)), hint: "С учетом тренда и календаря" },
      { label: "Уверенность", value: confidence, hint: `${last30Count} заказов за последние 30 дней` },
    ],
    factors: [
      { label: "Тренд продаж", value: formatPercent(Math.round((trend - 1) * 100), 100), hint: "Последние 30 дней к предыдущим 30" },
      { label: "Выходные", value: String(monthShape.weekends), hint: "Дней с повышенным спросом" },
      { label: "Праздники", value: String(monthShape.holidays), hint: "Фиксированные праздничные даты месяца" },
      { label: "Риск отмен", value: formatPercent(cancelledCount, totalCount), hint: "Учитывается как понижающий фактор" },
    ],
  };
}

export async function getSalesAnalytics({
  period,
  date,
  user,
}: {
  period: SalesAnalyticsPeriod;
  date?: string;
  user: AuthenticatedApiUser;
}): Promise<SalesAnalyticsDto> {
  const startedAt = performance.now();
  const range = buildSalesAnalyticsRange(period, date);
  const rangeStart = new Date(range.start);
  const rangeEnd = new Date(range.end);
  const lookbackStart = addDays(rangeEnd, -60).toISOString();
  const availability = {
    orders: hasApiPermission(user, "view_orders"),
    catalog: hasApiPermission(user, "view_catalog"),
    inventory: hasApiPermission(user, "view_inventory"),
  };
  const data = await getSalesAnalyticsRepositoryData({
    start: range.start,
    end: range.end,
    lookbackStart,
  });
  const completedOrdersCount = toNumber(data.orderTotals.completed_count);
  const periodOrdersCount = toNumber(data.orderTotals.period_orders_count);
  const cancelledOrdersCount = toNumber(data.orderTotals.cancelled_count);
  const activeOrdersCount = toNumber(data.orderTotals.active_count);
  const revenueCents = availability.orders ? toNumber(data.orderTotals.revenue_cents) : 0;
  const subtotalCents = availability.orders ? toNumber(data.orderTotals.subtotal_cents) : 0;
  const activePipelineCents = availability.orders ? toNumber(data.orderTotals.active_value_cents) : 0;
  const averageCheckCents = completedOrdersCount ? Math.round(revenueCents / completedOrdersCount) : 0;
  const estimatedCogsCents = availability.inventory ? toNumber(data.profitability.estimated_cogs_cents) : 0;
  const purchaseCents = availability.inventory ? toNumber(data.actTotals.incoming_total_cents) : 0;
  const writeoffCents = availability.inventory ? toNumber(data.actTotals.writeoff_total_cents) : 0;
  const incomingCount = availability.inventory ? toNumber(data.actTotals.incoming_count) : 0;
  const writeoffCount = availability.inventory ? toNumber(data.actTotals.writeoff_count) : 0;
  const productMarginCents = revenueCents - estimatedCogsCents;
  const operatingMarginCents = revenueCents - purchaseCents - writeoffCents;
  const discountCents = Math.max(subtotalCents - revenueCents, 0);

  const kpis: SalesAnalyticsMetric[] = [
    { label: "Выручка", value: formatMoney(revenueCents), hint: `${completedOrdersCount} оплаченных заказов`, href: "/dashboard/orders" },
    { label: "Средний чек", value: formatMoney(averageCheckCents), hint: "Итог заказа после скидок", href: "/dashboard/orders" },
    { label: "Маржа по блюдам", value: formatMoney(productMarginCents), hint: `${formatPercent(productMarginCents, revenueCents)} после техкарт`, href: "/dashboard/inventory", tone: productMarginCents < 0 ? "danger" : "good" },
    { label: "Опер. маржа", value: formatMoney(operatingMarginCents), hint: `${formatPercent(operatingMarginCents, revenueCents)} после закупок и списаний`, href: `/dashboard/reports?month=${range.date.slice(0, 7)}`, tone: operatingMarginCents < 0 ? "danger" : "good" },
  ];

  const profitability: SalesAnalyticsMetric[] = [
    { label: "Себестоимость проданных блюд", value: formatMoney(estimatedCogsCents), hint: `${formatPercent(estimatedCogsCents, revenueCents)} от выручки` },
    { label: "Закупки периода", value: formatMoney(purchaseCents), hint: `${incomingCount} завершенных актов`, href: "/dashboard/inventory" },
    { label: "Списания периода", value: formatMoney(writeoffCents), hint: `${writeoffCount} завершенных актов`, href: "/dashboard/inventory" },
    { label: "Скидки", value: formatMoney(discountCents), hint: `${formatPercent(discountCents, subtotalCents)} от суммы до скидки` },
  ];

  const orderFlow: SalesAnalyticsMetric[] = [
    { label: "В работе", value: String(activeOrdersCount), hint: formatMoney(activePipelineCents), href: "/dashboard/orders/dispatcher" },
    { label: "Закрытые", value: String(completedOrdersCount), hint: formatMoney(revenueCents), href: "/dashboard/orders" },
    { label: "Отмененные", value: String(cancelledOrdersCount), hint: `${formatPercent(cancelledOrdersCount, periodOrdersCount)} от заказов`, href: "/dashboard/orders", tone: cancelledOrdersCount ? "warning" : "good" },
  ];

  const revenueByCategory = availability.orders
    ? data.revenueByCategory.map((item) => {
      const value = toNumber(item.value_cents);
      return { label: item.label, value: formatMoney(value), hint: `${formatPercent(value, revenueCents)} от выручки` };
    })
    : [];
  const sourceFlow = availability.orders
    ? data.sourceFlow.map((item) => {
      const value = toNumber(item.value_cents);
      return { label: item.label, value: formatMoney(value), hint: `${formatPercent(value, revenueCents)} от выручки` };
    })
    : [];
  const menuPerformance = availability.inventory
    ? data.menuPerformance.map((item) => {
      const revenue = toNumber(item.revenue_cents);
      const cost = toNumber(item.cost_cents);
      const margin = revenue - cost;
      return {
        label: item.label,
        value: formatMoney(margin),
        hint: `${formatNumber(Number(item.quantity ?? 0))} шт · выручка ${formatMoney(revenue)} · cost ${formatPercent(cost, revenue)}`,
      };
    })
    : [];
  const readiness: SalesAnalyticsMetric[] = [
    { label: "Техкарты", value: `${availability.inventory ? toNumber(data.inventoryTotals.tech_cards_count) : 0}`, hint: "База для себестоимости блюд", href: "/dashboard/inventory" },
    { label: "Связка прайса", value: `${availability.catalog ? toNumber(data.inventoryTotals.linked_catalog_items_count) : 0}/${availability.catalog ? toNumber(data.inventoryTotals.catalog_items_count) : 0}`, hint: "Позиции каталога с техкартами", href: "/dashboard/catalog" },
    { label: "Склад", value: formatMoney(availability.inventory ? toNumber(data.inventoryTotals.stock_value_cents) : 0), hint: `${availability.inventory ? toNumber(data.inventoryTotals.products_count) : 0} продуктов`, href: "/dashboard/inventory" },
  ];

  return {
    range,
    periodOptions: buildPeriodOptions(range.period, range.selectedDate),
    previousHref: buildSalesHref(range.period, range.previousDate),
    nextHref: buildSalesHref(range.period, range.nextDate),
    dateParts: buildDateParts(range.selectedDate),
    kpis,
    orderFlow,
    salesForecast: buildForecast({
      range,
      last30Count: toNumber(data.forecast.last30_count),
      last30RevenueCents: toNumber(data.forecast.last30_revenue_cents),
      previous30RevenueCents: toNumber(data.forecast.previous30_revenue_cents),
      cancelledCount: toNumber(data.forecast.cancelled_count),
      totalCount: toNumber(data.forecast.total_count),
      subtotalCents: toNumber(data.forecast.subtotal_cents),
      revenueCents: toNumber(data.forecast.revenue_cents),
    }),
    profitability,
    revenueByCategory,
    sourceFlow,
    menuPerformance,
    readiness,
    reportActions: [
      { label: "Заказы", href: "/dashboard/orders", hint: "Открыть список заказов" },
      { label: "Месячный отчет", href: `/dashboard/reports?month=${range.date.slice(0, 7)}`, hint: "Сводка по отчетам" },
      { label: "Склад", href: "/dashboard/inventory", hint: "Закупки и списания" },
      { label: "Каталог", href: "/dashboard/catalog", hint: "Прайс и техкарты" },
    ],
    availability,
    diagnostics: process.env.PERF_DEBUG === "true"
      ? {
        durationMs: Math.round(performance.now() - startedAt),
        rows: data.rows,
        dbDurationMs: data.timings.reduce((total, timing) => total + timing.durationMs, 0),
        queryTimings: data.timings,
      }
      : undefined,
  };
}
