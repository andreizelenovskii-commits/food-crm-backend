import { ValidationError } from "@backend/shared/errors/app-error";
import {
  SALES_ANALYTICS_PERIODS,
  type SalesAnalyticsPeriod,
} from "@backend/modules/sales-analytics/sales-analytics.types";

export type SalesAnalyticsQuery = {
  period: SalesAnalyticsPeriod;
  date?: string;
};

export function parseSalesAnalyticsQuery(query: unknown): SalesAnalyticsQuery {
  const source = query && typeof query === "object"
    ? query as Record<string, unknown>
    : {};
  const period = typeof source.period === "string" ? source.period : "month";
  const date = typeof source.date === "string" ? source.date : undefined;

  if (!SALES_ANALYTICS_PERIODS.includes(period as SalesAnalyticsPeriod)) {
    throw new ValidationError("Некорректный период аналитики продаж");
  }

  if (date && !/^\d{4}(?:-\d{2})?(?:-\d{2})?$/.test(date)) {
    throw new ValidationError("Некорректная дата аналитики продаж");
  }

  return {
    period: period as SalesAnalyticsPeriod,
    date,
  };
}
