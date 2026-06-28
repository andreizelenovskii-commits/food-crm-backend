import type { FastifyInstance } from "fastify";
import { requirePermission } from "@backend/modules/auth/auth-context";
import { getNumericParam, getRequestBody } from "@backend/lib/request";
import {
  addManagementAccountingManualEntry,
  closeDailyManagementAccounting,
  editManagementAccountingManualEntry,
  getManagementAccounting,
  removeManagementAccountingManualEntry,
  startDailyManagementAccounting,
} from "@backend/modules/management-accounting/management-accounting.service";
import {
  parseManagementAccountingDayActionInput,
  parseManagementAccountingManualEntryInput,
  parseManagementAccountingQuery,
} from "@backend/modules/management-accounting/management-accounting.validation";
import { writeAuditLog } from "@backend/modules/audit/audit-log";
import { ValidationError } from "@backend/shared/errors/app-error";

export async function registerManagementAccountingRoutes(app: FastifyInstance) {
  const requireDashboard = requirePermission("view_dashboard");

  app.get(
    "/api/v1/analytics/management",
    { preHandler: requireDashboard },
    async (request) => {
      const query = parseManagementAccountingQuery(request.query);
      const data = await getManagementAccounting({
        ...query,
        user: request.authUser!,
      });

      return { data };
    },
  );

  app.post(
    "/api/v1/analytics/management/day/start",
    { preHandler: requireDashboard },
    async (request) => {
      const input = parseManagementAccountingDayActionInput(getRequestBody(request));
      const day = await startDailyManagementAccounting({
        ...input,
        user: request.authUser!,
      });
      await writeAuditLog({
        request,
        action: "management_accounting.day.start",
        entityType: "management_accounting_day",
        entityId: day.id ? String(day.id) : undefined,
        after: day,
      });

      return { data: day };
    },
  );

  app.post(
    "/api/v1/analytics/management/day/close",
    { preHandler: requireDashboard },
    async (request) => {
      const input = parseManagementAccountingDayActionInput(getRequestBody(request));
      const day = await closeDailyManagementAccounting({
        ...input,
        user: request.authUser!,
      });
      await writeAuditLog({
        request,
        action: "management_accounting.day.close",
        entityType: "management_accounting_day",
        entityId: day.id ? String(day.id) : undefined,
        after: day,
      });

      return { data: day };
    },
  );

  app.post(
    "/api/v1/analytics/management/manual-entries",
    { preHandler: requireDashboard },
    async (request) => {
      const input = parseManagementAccountingManualEntryInput(getRequestBody(request));
      const entry = await addManagementAccountingManualEntry(input, request.authUser!);
      await writeAuditLog({
        request,
        action: "management_accounting.manual_entry.create",
        entityType: "management_accounting_entry",
        entityId: String(entry.id),
        after: entry,
      });

      return { data: entry };
    },
  );

  app.patch(
    "/api/v1/analytics/management/manual-entries/:entryId",
    { preHandler: requireDashboard },
    async (request) => {
      const entryId = getNumericParam(request, "entryId");
      const input = parseManagementAccountingManualEntryInput(getRequestBody(request));
      const entry = await editManagementAccountingManualEntry(entryId, input);

      if (!entry) {
        throw new ValidationError("Статья управленческого учета не найдена");
      }

      await writeAuditLog({
        request,
        action: "management_accounting.manual_entry.update",
        entityType: "management_accounting_entry",
        entityId: String(entry.id),
        after: entry,
      });

      return { data: entry };
    },
  );

  app.delete(
    "/api/v1/analytics/management/manual-entries/:entryId",
    { preHandler: requireDashboard },
    async (request) => {
      const entryId = getNumericParam(request, "entryId");
      const deleted = await removeManagementAccountingManualEntry(entryId);

      if (!deleted) {
        throw new ValidationError("Статья управленческого учета не найдена");
      }

      await writeAuditLog({
        request,
        action: "management_accounting.manual_entry.delete",
        entityType: "management_accounting_entry",
        entityId: String(entryId),
        after: { deleted },
      });

      return { data: { deleted } };
    },
  );
}
