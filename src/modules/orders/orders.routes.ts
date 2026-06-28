import type { FastifyInstance } from "fastify";
import {
  addOrder,
  chooseOrderPackaging,
  fetchOrderById,
  fetchOrderCreateOptions,
  fetchKitchenOrders,
  fetchOrders,
  fetchOrdersByClientId,
  fetchPackagingOptions,
  updateOrderStatusById,
} from "@backend/modules/orders/orders.service";
import {
  createPublicOrder,
  fetchPublicOrderStatus,
  parsePublicOrderInput,
} from "@backend/modules/orders/public-orders.service";
import { decodePublicClientSession } from "@backend/modules/public-auth/public-session";
import { backendEnv } from "@backend/config/env";
import { ORDER_STATUSES, type OrderStatus } from "@backend/modules/orders/orders.types";
import { parseCreateOrderInput } from "@backend/modules/orders/orders.validation";
import {
  canAdjustDeliveryFee,
  canAdvanceOrder,
  canCancelOrder,
  canCreateOrders,
  canViewKitchenQueue,
  DEFAULT_DELIVERY_FEE_CENTS,
  getNextOrderStatus,
  INITIAL_ORDER_STATUS,
} from "@backend/modules/orders/orders.workflow";
import { ValidationError } from "@backend/shared/errors/app-error";
import { authenticateRequest, requirePermission } from "@backend/modules/auth/auth-context";
import { hasApiPermission } from "@backend/modules/access/access-control";
import { getNumericParam, getRequestBody, getStringBodyField, toFormData } from "@backend/lib/request";
import { writeAuditLog } from "@backend/modules/audit/audit-log";
import { AuthorizationError } from "@backend/lib/http-errors";

export async function registerOrdersRoutes(app: FastifyInstance) {
  app.post("/api/v1/public/orders", async (request) => {
    const session = decodePublicClientSession(request.cookies[backendEnv.clientSessionCookieName]);

    if (!session) {
      throw new ValidationError("Войдите или зарегистрируйтесь перед оформлением заказа");
    }

    const order = await createPublicOrder(
      session.phone,
      parsePublicOrderInput(getRequestBody(request)),
    );

    await writeAuditLog({
      request,
      action: "order.create",
      entityType: "order",
      entityId: order.id,
      after: {
        orderId: order.id,
        status: order.status,
        source: "SITE",
      },
    });

    return { data: order };
  });

  app.get("/api/v1/public/orders/:orderId", async (request) => {
    const session = decodePublicClientSession(request.cookies[backendEnv.clientSessionCookieName]);

    if (!session) {
      throw new ValidationError("Войдите, чтобы посмотреть статус заказа");
    }

    return {
      data: await fetchPublicOrderStatus(getNumericParam(request, "orderId"), session.phone),
    };
  });

  app.get("/api/v1/orders", { preHandler: requirePermission("view_orders") }, async () => ({
    data: await fetchOrders(),
  }));

  app.get("/api/v1/orders/options", { preHandler: requirePermission("view_orders") }, async () => ({
    data: await fetchOrderCreateOptions(),
  }));

  app.get("/api/v1/orders/kitchen", { preHandler: requirePermission("view_orders") }, async (request) => {
    const user = request.authUser;

    if (!user || !canViewKitchenQueue(user.role)) {
      throw new AuthorizationError("Access denied");
    }

    return {
      data: await fetchKitchenOrders(),
    };
  });

  app.get("/api/v1/orders/packaging-options", { preHandler: requirePermission("view_orders") }, async () => ({
    data: await fetchPackagingOptions(),
  }));

  app.get("/api/v1/orders/client/:clientId", { preHandler: requirePermission("view_orders") }, async (request) => ({
    data: await fetchOrdersByClientId(getNumericParam(request, "clientId")),
  }));

  app.post("/api/v1/orders", { preHandler: requirePermission("manage_orders") }, async (request) => {
    const user = request.authUser;

    if (!user || !canCreateOrders(user.role)) {
      throw new ValidationError("У вашей роли нет права создавать заказы");
    }

    const formData = toFormData(getRequestBody(request), [
      "clientId",
      "employeeId",
      "source",
      "isInternal",
      "deliveryFeeCents",
      "items",
    ]);
    formData.set("status", INITIAL_ORDER_STATUS);
    const input = parseCreateOrderInput(formData);

    const order = await addOrder({
      ...input,
      status: INITIAL_ORDER_STATUS,
      deliveryFeeCents: input.isInternal
        ? 0
        : canAdjustDeliveryFee(user.role)
          ? input.deliveryFeeCents
          : DEFAULT_DELIVERY_FEE_CENTS,
    });
    await writeAuditLog({
      request,
      action: "order.create",
      entityType: "order",
      entityId: order.id,
      after: order,
    });

    return {
      data: order,
    };
  });

  app.get("/api/v1/orders/:orderId", { preHandler: requirePermission("view_orders") }, async (request) => ({
    data: await fetchOrderById(getNumericParam(request, "orderId")),
  }));

  app.patch("/api/v1/orders/:orderId/status", { preHandler: authenticateRequest }, async (request) => {
    const user = request.authUser;
    const orderId = getNumericParam(request, "orderId");
    const order = await fetchOrderById(orderId);
    const nextStatus = getStringBodyField(getRequestBody(request), "status");

    if (!user) {
      throw new ValidationError("Пользователь не найден");
    }

    if (!order) {
      throw new ValidationError("Заказ не найден");
    }

    if (!ORDER_STATUSES.includes(nextStatus as OrderStatus)) {
      throw new ValidationError("Выбери корректный статус заказа");
    }

    if (nextStatus === "CANCELLED") {
      if (!hasApiPermission(user, "cancel_orders") || !canCancelOrder(order.status, user.role)) {
        throw new ValidationError("У вашей роли нет права отменить этот заказ");
      }
    } else if (!hasApiPermission(user, "manage_orders") || nextStatus !== getNextOrderStatus(order.status) || !canAdvanceOrder(order.status, user.role)) {
      throw new ValidationError("У вашей роли нет права перевести заказ в этот статус");
    }

    const updatedOrder = await updateOrderStatusById(orderId, nextStatus as OrderStatus, order.status, user.id);
    await writeAuditLog({
      request,
      action: nextStatus === "CANCELLED" ? "order.cancel" : "order.status.change",
      entityType: "order",
      entityId: orderId,
      before: order,
      after: updatedOrder,
    });

    return { data: updatedOrder };
  });

  app.post("/api/v1/orders/:orderId/packaging", { preHandler: authenticateRequest }, async (request) => {
    const user = request.authUser;
    const body = getRequestBody(request);
    const orderId = getNumericParam(request, "orderId");
    const orderItemId = Number(body?.orderItemId);
    const unitIndex = Number(body?.unitIndex);
    const packageProductId = Number(body?.packageProductId);
    const kitchenZone = String(body?.kitchenZone ?? "").trim();

    if (!user) {
      throw new ValidationError("Пользователь не найден");
    }

    if (!canAdvanceOrder("SENT_TO_KITCHEN", user.role)) {
      throw new ValidationError("У вашей роли нет права выбирать упаковку");
    }

    const before = await fetchOrderById(orderId);
    const updatedOrder = await chooseOrderPackaging({
      orderId,
      orderItemId,
      unitIndex,
      inputKitchenZone: kitchenZone || undefined,
      packageProductId,
      actorUserId: user.id,
    });

    await writeAuditLog({
      request,
      action: "order.packaging.choose",
      entityType: "order",
      entityId: orderId,
      before,
      after: updatedOrder,
    });

    return { data: updatedOrder };
  });
}
