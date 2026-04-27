import {
  formatHours,
  normalizeEmployeeSchedule,
} from "@backend/modules/employees/employees.schedule";
import type { UserRole } from "@backend/modules/auth/auth.types";
import {
  getDashboardAggregateData,
  getEmployeeDashboardSourceByEmail,
} from "@backend/modules/dashboard/dashboard.repository";
import type {
  DashboardSnapshot,
  EmployeeDashboardSnapshot,
} from "@backend/modules/dashboard/dashboard.types";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parseMonthKey(monthKey?: string | null) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }

  const [year, month] = monthKey.split("-").map(Number);

  if (!year || !month || month < 1 || month > 12) {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }

  return new Date(year, month - 1, 1);
}

export async function getDashboardMetrics(): Promise<DashboardSnapshot> {
  const {
    entityCounts,
    totalRevenueCents,
    averageOrderCents,
    completedOrders,
    completedRevenueCents,
    monthOrders,
    monthRevenueCents,
  } = await getDashboardAggregateData();

  return {
    entityCounts,
    statistics: [
      {
        label: "Всего заказов",
        value: formatNumber(entityCounts.orders),
        hint: "Все созданные заказы в системе",
      },
      {
        label: "Активная база клиентов",
        value: formatNumber(entityCounts.clients),
        hint: "Клиенты, доступные менеджерам CRM",
      },
      {
        label: "Команда",
        value: formatNumber(entityCounts.employees),
        hint: "Сотрудники, чьи профили уже заведены",
      },
    ],
    sales: [
      {
        label: "Оборот за всё время",
        value: formatMoney(totalRevenueCents),
        hint: "Сумма всех заказов независимо от статуса",
      },
      {
        label: "Средний чек",
        value: formatMoney(averageOrderCents),
        hint: "Средняя сумма одного заказа",
      },
      {
        label: "Продажи за месяц",
        value: `${formatMoney(monthRevenueCents)} · ${formatNumber(monthOrders)}`,
        hint: "Выручка и число заказов в текущем месяце",
      },
      {
        label: "Завершённые продажи",
        value: `${formatMoney(completedRevenueCents)} · ${formatNumber(completedOrders)}`,
        hint: "Оплаченные и завершённые заказы",
      },
    ],
  };
}

export async function getEmployeeDashboardMetricsByEmail(
  email: string,
  monthKey?: string | null,
): Promise<EmployeeDashboardSnapshot> {
  const selectedMonth = parseMonthKey(monthKey);
  const selectedMonthKey = formatMonthKey(selectedMonth);
  const nextMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1);
  const monthStart = `${selectedMonthKey}-01`;
  const monthEnd = `${formatMonthKey(nextMonth)}-01`;
  const employee = await getEmployeeDashboardSourceByEmail(email, monthStart, monthEnd);

  if (!employee) {
    return null;
  }

  const normalizedSchedule = normalizeEmployeeSchedule(
    employee.schedule as Parameters<typeof normalizeEmployeeSchedule>[0],
    selectedMonth,
  );
  const scheduleStats = Object.values(normalizedSchedule.days).reduce(
    (acc, day) => ({
      scheduleDays: acc.scheduleDays + 1,
      scheduleHours:
        acc.scheduleHours + day.shifts.reduce((sum, shift) => sum + shift.hours, 0),
    }),
    { scheduleDays: 0, scheduleHours: 0 },
  );
  const dayWord =
    scheduleStats.scheduleDays % 10 === 1 && scheduleStats.scheduleDays % 100 !== 11
      ? "день"
      : scheduleStats.scheduleDays % 10 >= 2 &&
          scheduleStats.scheduleDays % 10 <= 4 &&
          (scheduleStats.scheduleDays % 100 < 10 || scheduleStats.scheduleDays % 100 >= 20)
        ? "дня"
        : "дней";
  const scheduleSummary = scheduleStats.scheduleDays
    ? `${scheduleStats.scheduleDays} ${dayWord} • ${formatHours(scheduleStats.scheduleHours)} ч`
    : "График не задан";

  return {
    role: employee.role as UserRole,
    monthKey: selectedMonthKey,
    monthLabel: new Intl.DateTimeFormat("ru-RU", {
      month: "long",
      year: "numeric",
    })
      .format(selectedMonth)
      .replace(/\s*г\.?$/, ""),
    scheduleSummary,
    scheduleDays: scheduleStats.scheduleDays,
    scheduleHours: scheduleStats.scheduleHours,
    advancesCents: employee.totals.ADVANCE ?? 0,
    finesCents: employee.totals.FINE ?? 0,
    debtCents: employee.totals.DEBT ?? 0,
    salaryTodayCents: 0,
  };
}
