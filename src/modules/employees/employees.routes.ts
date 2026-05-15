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
    return { data: await addEmployee(input) };
  });

  app.get("/api/v1/employees/:employeeId", { preHandler: requirePermission("view_employees") }, async (request) => ({
    data: await fetchEmployeeById(getNumericParam(request, "employeeId")),
  }));

  app.patch("/api/v1/employees/:employeeId", { preHandler: requirePermission("manage_employees") }, async (request) => {
    const input = parseUpdateEmployeeInput(toFormData(getRequestBody(request), EMPLOYEE_FIELDS));
    return { data: await updateEmployeeService(getNumericParam(request, "employeeId"), input) };
  });

  app.delete("/api/v1/employees/:employeeId", { preHandler: requirePermission("manage_employees") }, async (request) => ({
    data: { deleted: await deleteEmployeeService(getNumericParam(request, "employeeId")) },
  }));

  app.post(
    "/api/v1/employees/:employeeId/adjustments",
    { preHandler: requirePermission("manage_employees") },
    async (request) => {
      const body = getRequestBody(request);
      const formData = toFormData(body, ["type", "amount", "comment", "date"]);
      formData.append("employeeId", String(getNumericParam(request, "employeeId")));
      const input = parseCreateEmployeeAdjustmentInput(formData);
      return { data: await addEmployeeAdjustment(input) };
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
      return { data: employee };
    },
  );
}
