import { hasApiPermission, type AuthenticatedApiUser } from "@backend/modules/access/access-control";
import {
  buildSalesAnalyticsRange,
} from "@backend/modules/sales-analytics/sales-analytics.periods";
import {
  getSalesAnalyticsRepositoryData,
} from "@backend/modules/sales-analytics/sales-analytics.repository";
import type {
  ManagementAccountingDto,
  ManagementAccountingMetric,
  ManagementAccountingRange,
} from "@backend/modules/management-accounting/management-accounting.types";

const MONEY_FORMATTER = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});
const NUMBER_FORMATTER = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });

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

function buildManagementHref(date: string) {
  return `/dashboard/management-accounting?date=${encodeURIComponent(date)}`;
}

function buildRange(date?: string): ManagementAccountingRange {
  const range = buildSalesAnalyticsRange("day", date);

  return {
    date: range.date,
    start: range.start,
    end: range.end,
    label: range.label,
    previousDate: range.previousDate,
    nextDate: range.nextDate,
  };
}

export async function getManagementAccounting({
  date,
  user,
}: {
  date?: string;
  user: AuthenticatedApiUser;
}): Promise<ManagementAccountingDto> {
  const range = buildRange(date);
  const availability = {
    orders: hasApiPermission(user, "view_orders"),
    inventory: hasApiPermission(user, "view_inventory"),
    manualOperations: false,
  };
  const data = await getSalesAnalyticsRepositoryData({
    start: range.start,
    end: range.end,
    lookbackStart: range.start,
  });

  const completedOrders = availability.orders ? toNumber(data.orderTotals.completed_count) : 0;
  const periodOrders = availability.orders ? toNumber(data.orderTotals.period_orders_count) : 0;
  const revenueCents = availability.orders ? toNumber(data.orderTotals.revenue_cents) : 0;
  const subtotalCents = availability.orders ? toNumber(data.orderTotals.subtotal_cents) : 0;
  const discountCents = Math.max(subtotalCents - revenueCents, 0);
  const averageCheckCents = completedOrders ? Math.round(revenueCents / completedOrders) : 0;
  const estimatedFoodCostCents = availability.inventory ? toNumber(data.profitability.estimated_cogs_cents) : 0;
  const purchaseCents = availability.inventory ? toNumber(data.actTotals.incoming_total_cents) : 0;
  const writeoffCents = availability.inventory ? toNumber(data.actTotals.writeoff_total_cents) : 0;
  const incomingCount = availability.inventory ? toNumber(data.actTotals.incoming_count) : 0;
  const writeoffCount = availability.inventory ? toNumber(data.actTotals.writeoff_count) : 0;
  const manualIncomeCents = 0;
  const manualExpenseCents = 0;
  const grossProfitCents = revenueCents - estimatedFoodCostCents;
  const grossMarginPercent = formatPercent(grossProfitCents, revenueCents);
  const foodCostPercent = formatPercent(estimatedFoodCostCents, revenueCents);
  const netProfitCents = revenueCents + manualIncomeCents - estimatedFoodCostCents - writeoffCents - manualExpenseCents;
  const netProfitPercent = formatPercent(netProfitCents, revenueCents);

  const kpis: ManagementAccountingMetric[] = [
    { label: "Выручка дня", value: formatMoney(revenueCents), hint: `${completedOrders} оплаченных заказов` },
    { label: "Фудкост", value: foodCostPercent, hint: formatMoney(estimatedFoodCostCents), tone: estimatedFoodCostCents > revenueCents * 0.35 ? "warning" : "good" },
    { label: "Маржинальность", value: grossMarginPercent, hint: formatMoney(grossProfitCents), tone: grossProfitCents < 0 ? "danger" : "good" },
    { label: "Чистая прибыль", value: formatMoney(netProfitCents), hint: `${netProfitPercent} от выручки`, tone: netProfitCents < 0 ? "danger" : "good" },
  ];

  const sales: ManagementAccountingMetric[] = [
    { label: "Все заказы", value: String(periodOrders), hint: "Созданы за выбранный день" },
    { label: "Оплаченные заказы", value: String(completedOrders), hint: formatMoney(revenueCents) },
    { label: "Средний чек", value: formatMoney(averageCheckCents), hint: "После скидок" },
    { label: "Скидки", value: formatMoney(discountCents), hint: `${formatPercent(discountCents, subtotalCents)} от суммы до скидки` },
  ];

  const income: ManagementAccountingMetric[] = [
    { label: "Продажи", value: formatMoney(revenueCents), hint: "Заказы в статусе оплачено/доставлено" },
    { label: "Прочие доходы", value: formatMoney(manualIncomeCents), hint: "Основа под ручной ввод доходов" },
  ];

  const expenses: ManagementAccountingMetric[] = [
    { label: "Себестоимость блюд", value: formatMoney(estimatedFoodCostCents), hint: `${foodCostPercent} от выручки по техкартам` },
    { label: "Списания", value: formatMoney(writeoffCents), hint: `${writeoffCount} завершенных актов` },
    { label: "Прочие расходы", value: formatMoney(manualExpenseCents), hint: "Основа под аренду, ФОТ, доставку и другие статьи" },
    { label: "Закупки", value: formatMoney(purchaseCents), hint: `${incomingCount} завершенных актов, пока как денежный поток` },
  ];

  const profit: ManagementAccountingMetric[] = [
    { label: "Валовая прибыль", value: formatMoney(grossProfitCents), hint: "Выручка минус себестоимость блюд", tone: grossProfitCents < 0 ? "danger" : "good" },
    { label: "Валовая маржа", value: grossMarginPercent, hint: "Доля валовой прибыли в выручке", tone: grossProfitCents < 0 ? "danger" : "good" },
    { label: "Чистая прибыль", value: formatMoney(netProfitCents), hint: "Без еще не заведенных ручных статей", tone: netProfitCents < 0 ? "danger" : "good" },
    { label: "Чистая маржа", value: netProfitPercent, hint: "Чистая прибыль к выручке", tone: netProfitCents < 0 ? "danger" : "good" },
  ];

  const foodCost: ManagementAccountingMetric[] = [
    { label: "Фудкост", value: foodCostPercent, hint: "Себестоимость блюд / выручка" },
    { label: "Себестоимость", value: formatMoney(estimatedFoodCostCents), hint: "Расчет по техкартам и ценам продуктов" },
    { label: "Списания к выручке", value: formatPercent(writeoffCents, revenueCents), hint: formatMoney(writeoffCents), tone: writeoffCents > revenueCents * 0.05 ? "warning" : "good" },
  ];

  const dataGaps: ManagementAccountingMetric[] = [
    { label: "Ручные доходы", value: "0", hint: "Нужна модель статей доходов для полного учета", tone: "warning" },
    { label: "Ручные расходы", value: "0", hint: "Нужна модель статей расходов: ФОТ, аренда, комиссии, доставка", tone: "warning" },
    { label: "Закупки", value: "Денежный поток", hint: "В чистой прибыли сейчас не списываются целиком, чтобы не смешивать закупку и себестоимость" },
  ];

  return {
    range,
    previousHref: buildManagementHref(range.previousDate),
    nextHref: buildManagementHref(range.nextDate),
    kpis,
    sales,
    income,
    expenses,
    profit,
    foodCost,
    dataGaps,
    rawTotals: {
      revenueCents,
      subtotalCents,
      discountCents,
      estimatedFoodCostCents,
      purchaseCents,
      writeoffCents,
      manualIncomeCents,
      manualExpenseCents,
      grossProfitCents,
      netProfitCents,
      completedOrders,
    },
    availability,
  };
}
