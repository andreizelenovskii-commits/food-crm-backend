import type { FastifyInstance } from "fastify";
import { authenticateRequest, requirePermission } from "@backend/modules/auth/auth-context";
import {
  closeDispatcherShift,
  getDispatcherShiftHistory,
  getDispatcherWorkspace,
  getPublicOrderingStatus,
  openDispatcherShift,
} from "@backend/modules/dispatcher-shifts/dispatcher-shifts.service";
import { parseShiftPersonName } from "@backend/modules/dispatcher-shifts/dispatcher-shifts.validation";
import { getNumericParam, getRequestBody } from "@backend/lib/request";
import { writeAuditLog } from "@backend/modules/audit/audit-log";
import { ValidationError } from "@backend/shared/errors/app-error";

export async function registerDispatcherShiftRoutes(app: FastifyInstance) {
  app.get("/api/v1/public/ordering-status", async () => ({
    data: await getPublicOrderingStatus(),
  }));

  app.get("/api/v1/dispatcher/workspace", { preHandler: authenticateRequest }, async (request) => {
    const user = request.authUser;

    if (!user) {
      throw new ValidationError("Пользователь не найден");
    }

    return {
      data: await getDispatcherWorkspace(user),
    };
  });

  app.post("/api/v1/dispatcher-shifts/open", { preHandler: requirePermission("manage_dispatcher_shift") }, async (request) => {
    const user = request.authUser;

    if (!user) {
      throw new ValidationError("Пользователь не найден");
    }

    const shift = await openDispatcherShift({
      responsibleName: parseShiftPersonName(getRequestBody(request)?.responsibleName, "Ответственный"),
      user,
    });

    await writeAuditLog({
      request,
      action: "shift.open",
      entityType: "dispatcher_shift",
      entityId: shift.id,
      after: {
        shiftId: shift.id,
        number: shift.number,
        businessDate: shift.businessDate,
        responsibleName: shift.responsibleName,
      },
    });

    return { data: shift };
  });

  app.post("/api/v1/dispatcher-shifts/:shiftId/close", { preHandler: requirePermission("manage_dispatcher_shift") }, async (request) => {
    const user = request.authUser;

    if (!user) {
      throw new ValidationError("Пользователь не найден");
    }

    const shift = await closeDispatcherShift({
      shiftId: getNumericParam(request, "shiftId"),
      closedByName: parseShiftPersonName(getRequestBody(request)?.closedByName, "Закрывающий"),
      user,
    });

    await writeAuditLog({
      request,
      action: "shift.close",
      entityType: "dispatcher_shift",
      entityId: shift?.id,
      after: shift,
    });

    return { data: shift };
  });

  app.get("/api/v1/dispatcher-shifts", { preHandler: requirePermission("view_dispatcher_shifts") }, async (request) => {
    const user = request.authUser;
    const query = request.query && typeof request.query === "object" ? request.query as { limit?: string } : {};
    const limit = Number(query.limit ?? 30);

    if (!user) {
      throw new ValidationError("Пользователь не найден");
    }

    return {
      data: await getDispatcherShiftHistory(user, Number.isInteger(limit) ? limit : 30),
    };
  });
}
