import { normalizeUserRole } from "@backend/modules/auth/auth.types";
import type {
  Employee,
  EmployeeAdjustment,
  EmployeeAdjustmentType,
  EmployeeSchedule,
  EmployeeScheduleLegacy,
} from "@backend/modules/employees/employees.types";

export type EmployeeRow = {
  id: number;
  name: string;
  email: string | null;
  role: string;
  phone: string | null;
  messenger: string | null;
  schedule: Employee["schedule"];
  monthlyHours: number | null;
  ordersCount?: string;
  birthDate: Date | null;
  hireDate: Date | null;
  createdAt: Date;
};

function hasShiftSchedule(
  schedule: EmployeeSchedule | EmployeeScheduleLegacy,
): schedule is EmployeeSchedule {
  return "shiftsPerDay" in schedule;
}

export function calculateMonthlyHours(
  schedule: EmployeeSchedule | EmployeeScheduleLegacy | null,
) {
  if (!schedule) {
    return null;
  }

  if (hasShiftSchedule(schedule)) {
    return Object.values(schedule.days).reduce(
      (sum, day) => sum + day.shifts.reduce((daySum, shift) => daySum + shift.hours, 0),
      0,
    );
  }

  return Object.values(schedule).reduce((sum, hours) => sum + hours, 0);
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function mapEmployeeRoleToUserRole(role: string) {
  return normalizeUserRole(role) ?? "Курьер";
}

export function mapRowToEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as Employee["role"],
    phone: row.phone,
    messenger: row.messenger,
    schedule: row.schedule,
    monthlyHours: row.monthlyHours,
    ordersCount: Number(row.ordersCount ?? 0),
    birthDate: row.birthDate ? formatDateOnly(row.birthDate) : null,
    hireDate: row.hireDate ? formatDateOnly(row.hireDate) : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapRowToAdjustment(row: {
  id: number;
  employeeId: number;
  type: string;
  amountCents: number;
  comment: string | null;
  createdAt: Date;
}): EmployeeAdjustment {
  return {
    id: row.id,
    employeeId: row.employeeId,
    type: row.type as EmployeeAdjustmentType,
    amountCents: row.amountCents,
    comment: row.comment,
    createdAt: row.createdAt.toISOString(),
  };
}
