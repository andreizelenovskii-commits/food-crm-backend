import { hasApiPermission, type AuthenticatedApiUser } from "@backend/modules/access/access-control";
import { getShiftByBusinessDate } from "@backend/modules/dispatcher-shifts/dispatcher-shifts.repository";
import {
  formatHours,
  formatScheduleDateKey,
  normalizeEmployeeSchedule,
} from "@backend/modules/employees/employees.schedule";
import {
  buildSalesAnalyticsRange,
} from "@backend/modules/sales-analytics/sales-analytics.periods";
import {
  getSalesAnalyticsRepositoryData,
} from "@backend/modules/sales-analytics/sales-analytics.repository";
import {
  createManagementAccountingManualEntry,
  closeManagementAccountingDay,
  deleteManagementAccountingManualEntry,
  getDailyEmployeeRows,
  getManagementAccountingDay,
  getManagementAccountingManualEntry,
  getManagementAccountingManualEntries,
  isManagementAccountingDayEditable,
  startManagementAccountingDay,
  updateManagementAccountingManualEntry,
} from "@backend/modules/management-accounting/management-accounting.repository";
import { ValidationError } from "@backend/shared/errors/app-error";
import type {
  ManagementAccountingDto,
  ManagementAccountingManualEntry,
  ManagementAccountingMetric,
  ManagementAccountingRange,
} from "@backend/modules/management-accounting/management-accounting.types";
import type { ManagementAccountingManualEntryInput } from "@backend/modules/management-accounting/management-accounting.validation";

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

function sumManualEntries(entries: ManagementAccountingManualEntry[], type: "INCOME" | "EXPENSE") {
  return entries
    .filter((entry) => entry.type === type)
    .reduce((total, entry) => total + entry.amountCents, 0);
}

function groupManualEntries(entries: ManagementAccountingManualEntry[], type: "INCOME" | "EXPENSE") {
  const groups = new Map<string, number>();

  for (const entry of entries) {
    if (entry.type !== type) {
      continue;
    }

    groups.set(entry.category, (groups.get(entry.category) ?? 0) + entry.amountCents);
  }

  return Array.from(groups.entries()).map(([label, value]) => ({
    label,
    value,
  }));
}

function buildStaffMembers(rows: Awaited<ReturnType<typeof getDailyEmployeeRows>>, date: string) {
  const referenceDate = new Date(`${date}T00:00:00`);
  const dateKey = formatScheduleDateKey(referenceDate);

  return rows
    .map((row) => {
      const schedule = normalizeEmployeeSchedule(row.schedule, referenceDate);
      const scheduledHours = schedule.days[dateKey]?.shifts.reduce((sum, shift) => sum + shift.hours, 0) ?? 0;
      const ordersCount = toNumber(row.ordersCount);
      const revenueCents = toNumber(row.revenueCents);
      const advancesCents = toNumber(row.advancesCents);
      const finesCents = toNumber(row.finesCents);
      const debtCents = toNumber(row.debtCents);
      const payoutCents = Math.max(advancesCents + debtCents - finesCents, 0);

      return {
        employeeId: row.employeeId,
        name: row.name,
        role: row.role,
        scheduledHours,
        ordersCount,
        revenueCents,
        advancesCents,
        finesCents,
        debtCents,
        payoutCents,
        summary: `${formatHours(scheduledHours)} ч · аванс ${formatMoney(advancesCents)} · штраф ${formatMoney(finesCents)}`,
      };
    })
    .filter((employee) =>
      employee.scheduledHours > 0 ||
      employee.ordersCount > 0 ||
      employee.advancesCents > 0 ||
      employee.finesCents > 0 ||
      employee.debtCents > 0,
    );
}

export async function addManagementAccountingManualEntry(
  input: ManagementAccountingManualEntryInput,
  user: AuthenticatedApiUser,
) {
  if (!await isManagementAccountingDayEditable(input.date)) {
    throw new ValidationError("Сначала начните управленческий учет за смену");
  }

  return createManagementAccountingManualEntry({
    ...input,
    createdByUserId: user.id,
  });
}

export async function editManagementAccountingManualEntry(
  entryId: number,
  input: ManagementAccountingManualEntryInput,
) {
  if (!await isManagementAccountingDayEditable(input.date)) {
    throw new ValidationError("Закрытый управленческий учет нельзя менять");
  }

  return updateManagementAccountingManualEntry({
    entryId,
    date: input.date,
    type: input.type,
    category: input.category,
    amountCents: input.amountCents,
    comment: input.comment,
  });
}

export async function removeManagementAccountingManualEntry(entryId: number) {
  const entry = await getManagementAccountingManualEntry(entryId);

  if (!entry) {
    return false;
  }

  if (!await isManagementAccountingDayEditable(entry.date)) {
    throw new ValidationError("Закрытый управленческий учет нельзя менять");
  }

  return deleteManagementAccountingManualEntry(entryId);
}

export async function startDailyManagementAccounting(input: {
  date: string;
  user: AuthenticatedApiUser;
}) {
  const current = await getManagementAccountingDay(input.date);

  if (current.status === "CLOSED") {
    throw new ValidationError("Управленческий учет за эту смену уже закрыт");
  }

  return startManagementAccountingDay({
    date: input.date,
    userId: input.user.id,
  });
}

export async function closeDailyManagementAccounting(input: {
  date: string;
  user: AuthenticatedApiUser;
}) {
  const closed = await closeManagementAccountingDay({
    date: input.date,
    userId: input.user.id,
  });

  if (!closed) {
    throw new ValidationError("Сначала начните управленческий учет за смену");
  }

  return closed;
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
    manualOperations: hasApiPermission(user, "view_dashboard"),
  };
  const [data, manualEntries, employeeRows, shift, accountingDay] = await Promise.all([
    getSalesAnalyticsRepositoryData({
      start: range.start,
      end: range.end,
      lookbackStart: range.start,
    }),
    getManagementAccountingManualEntries(range.date),
    getDailyEmployeeRows({ start: range.start, end: range.end }),
    getShiftByBusinessDate(range.date),
    getManagementAccountingDay(range.date),
  ]);
  const staffMembers = buildStaffMembers(employeeRows, range.date);
  const staffTotals = staffMembers.reduce(
    (acc, employee) => ({
      scheduledHours: acc.scheduledHours + employee.scheduledHours,
      advancesCents: acc.advancesCents + employee.advancesCents,
      finesCents: acc.finesCents + employee.finesCents,
      debtCents: acc.debtCents + employee.debtCents,
      payoutCents: acc.payoutCents + employee.payoutCents,
    }),
    {
      scheduledHours: 0,
      advancesCents: 0,
      finesCents: 0,
      debtCents: 0,
      payoutCents: 0,
    },
  );

  const completedOrders = availability.orders ? toNumber(data.orderTotals.completed_count) : 0;
  const periodOrders = availability.orders ? toNumber(data.orderTotals.period_orders_count) : 0;
  const revenueCents = availability.orders ? (shift?.revenueCents ?? toNumber(data.orderTotals.revenue_cents)) : 0;
  const subtotalCents = availability.orders ? toNumber(data.orderTotals.subtotal_cents) : 0;
  const discountCents = Math.max(subtotalCents - revenueCents, 0);
  const averageCheckCents = completedOrders ? Math.round(revenueCents / completedOrders) : 0;
  const estimatedFoodCostCents = availability.inventory ? toNumber(data.profitability.estimated_cogs_cents) : 0;
  const purchaseCents = availability.inventory ? toNumber(data.actTotals.incoming_total_cents) : 0;
  const writeoffCents = availability.inventory ? toNumber(data.actTotals.writeoff_total_cents) : 0;
  const incomingCount = availability.inventory ? toNumber(data.actTotals.incoming_count) : 0;
  const writeoffCount = availability.inventory ? toNumber(data.actTotals.writeoff_count) : 0;
  const manualIncomeCents = sumManualEntries(manualEntries, "INCOME");
  const manualExpenseCents = sumManualEntries(manualEntries, "EXPENSE");
  const staffPayoutCents = staffTotals.payoutCents;
  const grossProfitCents = revenueCents - estimatedFoodCostCents;
  const grossMarginPercent = formatPercent(grossProfitCents, revenueCents);
  const foodCostPercent = formatPercent(estimatedFoodCostCents, revenueCents);
  const netProfitCents = revenueCents + manualIncomeCents - estimatedFoodCostCents - writeoffCents - staffPayoutCents - manualExpenseCents;
  const netProfitPercent = formatPercent(netProfitCents, revenueCents);
  const manualIncomeGroups = groupManualEntries(manualEntries, "INCOME");
  const manualExpenseGroups = groupManualEntries(manualEntries, "EXPENSE");

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
    { label: "Прочие доходы", value: formatMoney(manualIncomeCents), hint: `${manualIncomeGroups.length} ручных статей` },
    ...manualIncomeGroups.map((item) => ({
      label: item.label,
      value: formatMoney(item.value),
      hint: "Ручная статья доходов",
    })),
  ];

  const expenses: ManagementAccountingMetric[] = [
    { label: "Себестоимость блюд", value: formatMoney(estimatedFoodCostCents), hint: `${foodCostPercent} от выручки по техкартам` },
    { label: "Списания", value: formatMoney(writeoffCents), hint: `${writeoffCount} завершенных актов` },
    { label: "Персонал за день", value: formatMoney(staffPayoutCents), hint: `Авансы и долги минус штрафы, ${formatHours(staffTotals.scheduledHours)} ч` },
    { label: "Прочие расходы", value: formatMoney(manualExpenseCents), hint: `${manualExpenseGroups.length} ручных статей: бензин, свет, аренда и т.д.` },
    ...manualExpenseGroups.map((item) => ({
      label: item.label,
      value: formatMoney(item.value),
      hint: "Ручная статья расходов",
    })),
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
    { label: "Ручные доходы", value: manualIncomeGroups.length ? String(manualIncomeGroups.length) : "0", hint: "Можно добавлять вручную за конкретный день", tone: manualIncomeGroups.length ? "good" : "warning" },
    { label: "Ручные расходы", value: manualExpenseGroups.length ? String(manualExpenseGroups.length) : "0", hint: "Бензин, аренда, свет, комиссии, доставка и любые другие статьи", tone: manualExpenseGroups.length ? "good" : "warning" },
    { label: "Закупки", value: "Денежный поток", hint: "В чистой прибыли сейчас не списываются целиком, чтобы не смешивать закупку и себестоимость" },
  ];

  return {
    range,
    accountingDay,
    previousHref: buildManagementHref(range.previousDate),
    nextHref: buildManagementHref(range.nextDate),
    kpis,
    sales,
    income,
    expenses,
    profit,
    foodCost,
    shift: shift
      ? {
        id: shift.id,
        number: shift.displayNumber,
        status: shift.status,
        openedAt: shift.openedAt,
        closedAt: shift.closedAt,
        checksCount: shift.checksCount,
        revenueCents: shift.revenueCents,
        totalOrdersCount: shift.totalOrdersCount,
        cancelledOrdersCount: shift.cancelledOrdersCount,
      }
      : null,
    staff: {
      members: staffMembers,
      totals: staffTotals,
    },
    manualEntries,
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
      staffPayoutCents,
      grossProfitCents,
      netProfitCents,
      completedOrders,
    },
    availability,
  };
}
