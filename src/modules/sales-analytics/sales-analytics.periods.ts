import {
  SALES_ANALYTICS_PERIODS,
  type SalesAnalyticsPeriod,
  type SalesAnalyticsRange,
} from "@backend/modules/sales-analytics/sales-analytics.types";

const SALES_PERIOD_LABELS: Record<SalesAnalyticsPeriod, string> = {
  day: "День",
  week: "Неделя",
  month: "Месяц",
  year: "Год",
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatMonthInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function parseDateInput(value: string | undefined, fallback = new Date()) {
  if (!value) {
    return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
  }

  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(value);
  if (!match) {
    return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
  }

  const year = Number(match[1]);
  const month = Number(match[2] ?? "01") - 1;
  const day = Number(match[3] ?? "01");
  const parsed = new Date(year, month, day);

  return Number.isNaN(parsed.getTime())
    ? new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate())
    : parsed;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function addYears(date: Date, years: number) {
  return new Date(date.getFullYear() + years, 0, 1);
}

function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  return start;
}

function formatRangeLabel(start: Date, end: Date, period: SalesAnalyticsPeriod) {
  if (period === "day") {
    return start.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  }

  if (period === "month") {
    return start.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  }

  if (period === "year") {
    return start.toLocaleDateString("ru-RU", { year: "numeric" });
  }

  const lastDay = addDays(end, -1);
  return `${start.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} - ${lastDay.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}`;
}

export function buildSalesHref(period: SalesAnalyticsPeriod, date: string) {
  return `/dashboard/sales?period=${period}&date=${encodeURIComponent(date)}`;
}

export function buildSalesAnalyticsRange(
  period: SalesAnalyticsPeriod,
  dateInput?: string,
): SalesAnalyticsRange {
  const base = parseDateInput(dateInput);
  const selectedDate = formatDateInput(base);
  let start: Date;
  let end: Date;
  let previousDate: string;
  let nextDate: string;
  let date: string;

  if (period === "day") {
    start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    end = addDays(start, 1);
    previousDate = formatDateInput(addDays(start, -1));
    nextDate = formatDateInput(addDays(start, 1));
    date = formatDateInput(start);
  } else if (period === "week") {
    start = startOfWeek(base);
    end = addDays(start, 7);
    previousDate = formatDateInput(addDays(start, -7));
    nextDate = formatDateInput(addDays(start, 7));
    date = formatDateInput(start);
  } else if (period === "year") {
    start = new Date(base.getFullYear(), 0, 1);
    end = addYears(start, 1);
    previousDate = String(start.getFullYear() - 1);
    nextDate = String(start.getFullYear() + 1);
    date = String(start.getFullYear());
  } else {
    start = new Date(base.getFullYear(), base.getMonth(), 1);
    end = addMonths(start, 1);
    previousDate = formatMonthInput(addMonths(start, -1));
    nextDate = formatMonthInput(addMonths(start, 1));
    date = formatMonthInput(start);
  }

  return {
    period,
    date,
    selectedDate,
    start: start.toISOString(),
    end: end.toISOString(),
    label: formatRangeLabel(start, end, period),
    previousDate,
    nextDate,
  };
}

export function buildPeriodOptions(period: SalesAnalyticsPeriod, selectedDate: string) {
  return SALES_ANALYTICS_PERIODS.map((item) => ({
    label: SALES_PERIOD_LABELS[item],
    href: buildSalesHref(item, selectedDate),
    isActive: item === period,
  }));
}

export function buildDateParts(selectedDate: string) {
  const date = parseDateInput(selectedDate);
  const currentYear = new Date().getFullYear();
  const selectedYear = date.getFullYear();
  const startYear = Math.min(currentYear - 5, selectedYear - 2);
  const endYear = Math.max(currentYear + 2, selectedYear + 2);

  return {
    day: pad(date.getDate()),
    month: pad(date.getMonth() + 1),
    year: String(selectedYear),
    days: Array.from({ length: 31 }, (_, index) => pad(index + 1)),
    months: Array.from({ length: 12 }, (_, index) => {
      const value = pad(index + 1);
      const label = new Date(2026, index, 1).toLocaleDateString("ru-RU", { month: "long" });
      return { value, label };
    }),
    years: Array.from({ length: endYear - startYear + 1 }, (_, index) => String(startYear + index)),
  };
}
