import type { FastifyInstance } from "fastify";
import {
  addEmployee,
  addEmployeeAdjustment,
  deleteEmployeeService,
  fetchEmployeeById,
  fetchEmployees,
  issueEmployeeAccessService,
  updateEmployeeService,
} from "@backend/modules/employees/employees.service";
import {
  parseCreateEmployeeAdjustmentInput,
  parseCreateEmployeeInput,
  parseUpdateEmployeeInput,
} from "@backend/modules/employees/employees.validation";
import { parseIssueEmployeeAccessInput } from "@backend/modules/employees/employee-access.validation";
import { requirePermission } from "@backend/modules/auth/auth-context";
import { getNumericParam, getRequestBody, toFormData } from "@backend/lib/request";
import { writeAuditLog } from "@backend/modules/audit/audit-log";
import { ValidationError } from "@backend/shared/errors/app-error";

const EMPLOYEE_FIELDS = [
  "name",
  "role",
  "phone",
  "messenger",
  "birthDate",
  "hireDate",
  "schedule",
  "monthlyHours",
];

export async function registerEmployeesRoutes(app: FastifyInstance) {
  app.get("/api/v1/employees", { preHandler: requirePermission("view_employees") }, async () => ({
    data: await fetchEmployees(),
  }));

  app.post("/api/v1/employees", { preHandler: requirePermission("manage_employees") }, async (request) => {
    const input = parseCreateEmployeeInput(toFormData(getRequestBody(request), EMPLOYEE_FIELDS));
    const employee = await addEmployee(input);
    await writeAuditLog({
      request,
      action: "employee.create",
      entityType: "employee",
      entityId: employee.id,
      after: employee,
    });
    return { data: employee };
  });

  app.get("/api/v1/employees/:employeeId", { preHandler: requirePermission("view_employees") }, async (request) => ({
    data: await fetchEmployeeById(getNumericParam(request, "employeeId")),
  }));

  app.patch("/api/v1/employees/:employeeId", { preHandler: requirePermission("manage_employees") }, async (request) => {
    const employeeId = getNumericParam(request, "employeeId");
    const before = await fetchEmployeeById(employeeId);
    const input = parseUpdateEmployeeInput(toFormData(getRequestBody(request), EMPLOYEE_FIELDS));
    const employee = await updateEmployeeService(employeeId, input);
    await writeAuditLog({
      request,
      action: input.role !== undefined ? "employee.role.update" : "employee.update",
      entityType: "employee",
      entityId: employeeId,
      before,
      after: employee,
    });
    return { data: employee };
  });

  app.delete("/api/v1/employees/:employeeId", { preHandler: requirePermission("manage_employees") }, async (request) => {
    const employeeId = getNumericParam(request, "employeeId");
    const before = await fetchEmployeeById(employeeId);
    const deleted = await deleteEmployeeService(employeeId);
    await writeAuditLog({
      request,
      action: "employee.delete",
      entityType: "employee",
      entityId: employeeId,
      before,
      after: { deleted },
    });
    return { data: { deleted } };
  });

  app.post(
    "/api/v1/employees/:employeeId/adjustments",
    { preHandler: requirePermission("manage_employees") },
    async (request) => {
      const body = getRequestBody(request);
      const formData = toFormData(body, ["type", "amount", "comment", "date"]);
      formData.append("employeeId", String(getNumericParam(request, "employeeId")));
      const input = parseCreateEmployeeAdjustmentInput(formData);
      const adjustment = await addEmployeeAdjustment(input);
      await writeAuditLog({
        request,
        action: "employee.adjustment.create",
        entityType: "employee",
        entityId: input.employeeId,
        after: adjustment,
      });
      return { data: adjustment };
    },
  );

  app.post(
    "/api/v1/employees/:employeeId/access",
    { preHandler: requirePermission("manage_employees") },
    async (request) => {
      const accessInput = parseIssueEmployeeAccessInput(toFormData(getRequestBody(request), ["phone", "password"]));
      const employee = await issueEmployeeAccessService({
        employeeId: getNumericParam(request, "employeeId"),
        ...accessInput,
      });

      if (!employee) {
        throw new ValidationError("Сотрудник не найден");
      }

      await writeAuditLog({
        request,
        action: "employee.access.update",
        entityType: "employee",
        entityId: employee.id,
        after: employee,
      });
      return { data: employee };
    },
  );
}
