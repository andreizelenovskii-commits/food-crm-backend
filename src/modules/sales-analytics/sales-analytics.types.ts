export const SALES_ANALYTICS_PERIODS = ["day", "week", "month", "year"] as const;

export type SalesAnalyticsPeriod = (typeof SALES_ANALYTICS_PERIODS)[number];

export type SalesAnalyticsMetric = {
  label: string;
  value?: string;
  hint: string;
  href?: string;
  tone?: "good" | "warning" | "danger";
};

export type SalesAnalyticsRange = {
  period: SalesAnalyticsPeriod;
  date: string;
  selectedDate: string;
  start: string;
  end: string;
  label: string;
  previousDate: string;
  nextDate: string;
};

export type SalesAnalyticsDto = {
  range: SalesAnalyticsRange;
  periodOptions: Array<{
    label: string;
    href: string;
    isActive: boolean;
  }>;
  previousHref: string;
  nextHref: string;
  dateParts: {
    day: string;
    month: string;
    year: string;
    days: string[];
    months: Array<{ value: string; label: string }>;
    years: string[];
  };
  kpis: SalesAnalyticsMetric[];
  orderFlow: SalesAnalyticsMetric[];
  salesForecast: {
    label: string;
    metrics: SalesAnalyticsMetric[];
    factors: SalesAnalyticsMetric[];
  };
  profitability: SalesAnalyticsMetric[];
  revenueByCategory: SalesAnalyticsMetric[];
  sourceFlow: SalesAnalyticsMetric[];
  menuPerformance: SalesAnalyticsMetric[];
  readiness: SalesAnalyticsMetric[];
  reportActions: SalesAnalyticsMetric[];
  availability: {
    orders: boolean;
    catalog: boolean;
    inventory: boolean;
  };
  diagnostics?: {
    durationMs: number;
    rows: Record<string, number>;
    dbDurationMs: number;
    queryTimings: Array<{
      name: string;
      durationMs: number;
      rows: number;
    }>;
  };
};
