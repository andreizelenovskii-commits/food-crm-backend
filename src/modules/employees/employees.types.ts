export const EMPLOYEE_ROLES = [
  "Управляющий",
  "Повар",
  "Диспетчер",
  "Курьер",
] as const;

export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

export const EMPLOYEE_ADJUSTMENT_TYPES = ["ADVANCE", "FINE", "DEBT"] as const;
export const EMPLOYEE_ADJUSTMENT_LABELS: Record<
  EmployeeAdjustmentType,
  string
> = {
  ADVANCE: "Аванс",
  FINE: "Штраф",
  DEBT: "Долг",
};

export type EmployeeAdjustmentType = (typeof EMPLOYEE_ADJUSTMENT_TYPES)[number];

export type EmployeeAdjustment = {
  id: number;
  employeeId: number;
  type: EmployeeAdjustmentType;
  amountCents: number;
  comment: string | null;
  createdAt: string;
};

export type EmployeeMonthlyOrderStat = {
  monthKey: string; // YYYY-MM
  ordersCount: number;
  revenueCents: number;
};

export type Shift = {
  hours: number;
};

export type DaySchedule = {
  shifts: Shift[];
};

export type EmployeeSchedule = {
  shiftsPerDay: 1 | 2;
  days: Record<string, DaySchedule>; // key: "2024-04-15"
};

// Legacy support - convert old format to new
export type EmployeeScheduleLegacy = Record<string, number>; // e.g., { "monday": 8, "tuesday": 8, ... }

export type Employee = {
  id: number;
  name: string;
  email?: string | null;
  role: EmployeeRole;
  phone: string | null;
  messenger: string | null;
  schedule: EmployeeSchedule | EmployeeScheduleLegacy | null;
  monthlyHours: number | null;
  ordersCount: number;
  birthDate?: string | null;
  hireDate?: string | null;
  createdAt: string;
};

export type EmployeeProfile = Employee & {
  advancesCents: number;
  finesCents: number;
  debtCents: number;
  kpd: number;
  ordersThisMonth: number;
  salaryTodayCents: number;
  adjustments: EmployeeAdjustment[];
  monthlyOrderStats: EmployeeMonthlyOrderStat[];
};
