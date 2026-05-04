import {
  createEmployee,
  createEmployeeAdjustment,
  deleteEmployee,
  getAllEmployees,
  getEmployeeById,
  getEmployeeAdjustments,
  getEmployeeAdjustmentTotals,
  getEmployeeOrdersThisMonth,
  getEmployeeOrderMonthlyStats,
  issueEmployeeAccess,
  updateEmployee,
} from "@backend/modules/employees/employees.repository";
import type { CreateEmployeeInput, UpdateEmployeeInput } from "@backend/modules/employees/employees.validation";
import type { Employee, EmployeeProfile } from "@backend/modules/employees/employees.types";

export async function fetchEmployees(): Promise<Employee[]> {
  return getAllEmployees();
}

export async function addEmployee(input: CreateEmployeeInput): Promise<Employee> {
  return createEmployee(input);
}

export async function updateEmployeeService(employeeId: number, input: UpdateEmployeeInput): Promise<Employee | null> {
  return updateEmployee(employeeId, input);
}

export async function deleteEmployeeService(employeeId: number): Promise<boolean> {
  return deleteEmployee(employeeId);
}

export async function issueEmployeeAccessService(input: {
  employeeId: number;
  phone: string;
  password: string;
}): Promise<Employee | null> {
  return issueEmployeeAccess(input);
}

export async function addEmployeeAdjustment(input: {
  employeeId: number;
  type: string;
  amountCents: number;
  comment: string | null;
  date: string;
}) {
  return createEmployeeAdjustment(input);
}

export async function fetchEmployeeById(
  employeeId: number,
): Promise<EmployeeProfile | null> {
  const employee = await getEmployeeById(employeeId);

  if (!employee) {
    return null;
  }

  const totals = await getEmployeeAdjustmentTotals(employeeId);
  const adjustments = await getEmployeeAdjustments(employeeId);
  const ordersThisMonth = await getEmployeeOrdersThisMonth(employeeId);
  const monthlyOrderStats = await getEmployeeOrderMonthlyStats(employeeId);

  return {
    ...employee,
    advancesCents: totals.ADVANCE ?? 0,
    finesCents: totals.FINE ?? 0,
    debtCents: totals.DEBT ?? 0,
    kpd: 0,
    ordersThisMonth,
    salaryTodayCents: 0,
    adjustments,
    monthlyOrderStats,
  };
}
