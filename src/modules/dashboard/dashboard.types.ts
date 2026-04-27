import type { UserRole } from "@backend/modules/auth/auth.types";

export type DashboardEntityCounts = {
  orders: number;
  clients: number;
  products: number;
  employees: number;
};

export type DashboardMetricCard = {
  label: string;
  value: string;
  hint: string;
};

export type DashboardSnapshot = {
  entityCounts: DashboardEntityCounts;
  statistics: DashboardMetricCard[];
  sales: DashboardMetricCard[];
};

export type EmployeeDashboardSnapshot = {
  role: UserRole;
  monthKey: string;
  monthLabel: string;
  scheduleSummary: string;
  scheduleDays: number;
  scheduleHours: number;
  advancesCents: number;
  finesCents: number;
  debtCents: number;
  salaryTodayCents: number;
} | null;
