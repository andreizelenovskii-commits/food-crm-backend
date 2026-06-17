import type { UserRole } from "@backend/modules/auth/auth.types";
import type { OrderStatus } from "@backend/modules/orders/orders.types";

export const INITIAL_ORDER_STATUS: OrderStatus = "SENT_TO_KITCHEN";
export const FINAL_ORDER_STATUS: OrderStatus = "DELIVERED_PAID";
export const DEFAULT_DELIVERY_FEE_CENTS = 17000;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  SENT_TO_KITCHEN: "Передан на кухню",
  READY: "Готов",
  PACKED: "Собран",
  DELIVERED_PAID: "Доставлен и оплачен",
  CANCELLED: "Отменён",
};

export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  SENT_TO_KITCHEN: "bg-amber-100 text-amber-800",
  READY: "bg-sky-100 text-sky-800",
  PACKED: "bg-violet-100 text-violet-800",
  DELIVERED_PAID: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-rose-100 text-rose-800",
};

const STATUS_OWNER_BY_STAGE: Partial<Record<OrderStatus, UserRole>> = {
  SENT_TO_KITCHEN: "Повар",
  READY: "Диспетчер",
  PACKED: "Курьер",
};

const NEXT_STATUS_BY_STAGE: Partial<Record<OrderStatus, OrderStatus>> = {
  SENT_TO_KITCHEN: "READY",
  READY: "PACKED",
  PACKED: "DELIVERED_PAID",
};

const NEXT_ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  SENT_TO_KITCHEN: "Заказ готов",
  READY: "Заказ собран",
  PACKED: "Заказ отвезён и оплачен",
};

export function isManagerRole(role: UserRole) {
  return (
    role === "admin" ||
    role === "Администратор" ||
    role === "Шеф повар" ||
    role === "Управляющий" ||
    role === "Старший курьер"
  );
}

export function canAdjustDeliveryFee(role: UserRole) {
  return isManagerRole(role);
}

export function canCreateOrders(role: UserRole) {
  return isManagerRole(role) || role === "Диспетчер";
}

export function canViewKitchenQueue(role: UserRole) {
  return isManagerRole(role) || role === "Повар";
}

export function isOrderClosed(status: OrderStatus) {
  return status === FINAL_ORDER_STATUS || status === "CANCELLED";
}

export function getOrderStageOwner(status: OrderStatus) {
  return STATUS_OWNER_BY_STAGE[status] ?? null;
}

export function getNextOrderStatus(status: OrderStatus) {
  return NEXT_STATUS_BY_STAGE[status] ?? null;
}

export function getNextOrderActionLabel(status: OrderStatus) {
  return NEXT_ACTION_LABELS[status] ?? null;
}

export function canCancelOrder(status: OrderStatus, role: UserRole) {
  if (isOrderClosed(status)) {
    return false;
  }

  return isManagerRole(role) || role === "Диспетчер";
}

export function canAdvanceOrder(status: OrderStatus, role: UserRole) {
  if (isOrderClosed(status)) {
    return false;
  }

  if (isManagerRole(role)) {
    return Boolean(getNextOrderStatus(status));
  }

  return getOrderStageOwner(status) === role;
}

export function getOrderAdvanceAction(status: OrderStatus, role: UserRole) {
  const nextStatus = getNextOrderStatus(status);
  const label = getNextOrderActionLabel(status);

  if (!nextStatus || !label || !canAdvanceOrder(status, role)) {
    return null;
  }

  return {
    status: nextStatus,
    label,
  };
}
