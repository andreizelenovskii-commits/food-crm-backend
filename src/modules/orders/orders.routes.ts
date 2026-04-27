import type { FastifyInstance } from "fastify";
import {
  addOrder,
  fetchOrderById,
  fetchOrderCreateOptions,
  fetchOrders,
  updateOrderStatusById,
} from "@backend/modules/orders/orders.service";
import { ORDER_STATUSES, type OrderStatus } from "@backend/modules/orders/orders.types";
import { parseCreateOrderInput } from "@backend/modules/orders/orders.validation";
import {
  canAdjustDeliveryFee,
  canAdvanceOrder,
  canCancelOrder,
  canCreateOrders,
  DEFAULT_DELIVERY_FEE_CENTS,
  getNextOrderStatus,
  INITIAL_ORDER_STATUS,
} from "@backend/modules/orders/orders.workflow";
import { ValidationError } from "@backend/shared/errors/app-error";
import { authenticateRequest, requirePermission } from "@backend/modules/auth/auth-context";
import { getNumericParam, getRequestBody, getStringBodyField, toFormData } from "@backend/lib/request";

export async function registerOrdersRoutes(app: FastifyInstance) {
  app.get("/api/v1/orders", { preHandler: requirePermission("view_orders") }, async () => ({
    data: await fetchOrders(),
  }));

  app.get("/api/v1/orders/options", { preHandler: requirePermission("view_orders") }, async () => ({
    data: await fetchOrderCreateOptions(),
  }));

  app.post("/api/v1/orders", { preHandler: requirePermission("manage_orders") }, async (request) => {
    const user = request.authUser;

    if (!user || !canCreateOrders(user.role)) {
      throw new ValidationError("У вашей роли нет права создавать заказы");
    }

    const formData = toFormData(getRequestBody(request), [
      "clientId",
      "employeeId",
      "isInternal",
      "deliveryFeeCents",
      "items",
    ]);
    formData.set("status", INITIAL_ORDER_STATUS);
    const input = parseCreateOrderInput(formData);

    return {
      data: await addOrder({
        ...input,
        status: INITIAL_ORDER_STATUS,
        deliveryFeeCents: input.isInternal
          ? 0
          : canAdjustDeliveryFee(user.role)
            ? input.deliveryFeeCents
            : DEFAULT_DELIVERY_FEE_CENTS,
      }),
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
      if (!canCancelOrder(order.status, user.role)) {
        throw new ValidationError("У вашей роли нет права отменить этот заказ");
      }
    } else if (nextStatus !== getNextOrderStatus(order.status) || !canAdvanceOrder(order.status, user.role)) {
      throw new ValidationError("У вашей роли нет права перевести заказ в этот статус");
    }

    return {
      data: await updateOrderStatusById(orderId, nextStatus as OrderStatus),
    };
  });
}
