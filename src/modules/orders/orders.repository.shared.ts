import type {
  KitchenZone,
  OrderItemSummary,
  OrderListItem,
  OrderPackagingUsage,
  OrderSource,
  OrderStatus,
} from "@backend/modules/orders/orders.types";

export type OrderRow = {
  id: number;
  status: string;
  source: string;
  isInternal: boolean;
  clientId: number | null;
  clientName: string;
  clientType: "CLIENT" | "ORGANIZATION";
  employeeId: number;
  employeeName: string;
  customerPhoneSnapshot: string | null;
  deliveryAddressSnapshot: string | null;
  customerComment: string | null;
  subtotalCents: number;
  discountPercent: number;
  totalCents: number;
  createdAt: Date;
};

export type CatalogOrderItemRow = {
  id: number;
  name: string;
  priceCents: number;
  isPublished: boolean;
  technologicalCardId: number;
  pizzaSize: string | null;
  rollSize: string | null;
};

export type OrderItemRow = {
  id: number;
  orderId: number;
  catalogItemId: number | null;
  itemName: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
  catalogCategory: string | null;
};

export type OrderPackagingUsageRow = {
  id: number;
  orderItemId: number;
  unitIndex: number;
  packageProductId: number;
  packageProductName: string;
  kitchenZone: string;
  createdAt: Date;
};

export const DELIVERY_ITEM_NAME = "Доставка";

function normalizeDbOrderStatus(status: string): OrderStatus {
  switch (status) {
    case "PENDING":
      return "SENT_TO_KITCHEN";
    case "PROCESSING":
      return "READY";
    case "COMPLETED":
      return "DELIVERED_PAID";
    case "SENT_TO_KITCHEN":
    case "READY":
    case "PACKED":
    case "DELIVERED_PAID":
    case "CANCELLED":
      return status;
    default:
      return "SENT_TO_KITCHEN";
  }
}

function normalizeOrderSource(source: string): OrderSource {
  switch (source) {
    case "SITE":
    case "PHONE":
    case "ADMIN":
      return source;
    default:
      return "ADMIN";
  }
}

export function mapRowToOrder(row: OrderRow): OrderListItem {
  return {
    id: row.id,
    status: normalizeDbOrderStatus(row.status),
    source: normalizeOrderSource(row.source),
    isInternal: row.isInternal,
    clientId: row.clientId,
    clientName: row.clientName,
    clientType: row.clientType,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    customerPhoneSnapshot: row.customerPhoneSnapshot,
    deliveryAddressSnapshot: row.deliveryAddressSnapshot,
    customerComment: row.customerComment,
    subtotalCents: row.subtotalCents,
    discountPercent: row.discountPercent,
    totalCents: row.totalCents,
    createdAt: row.createdAt.toISOString(),
    items: [],
  };
}

export function resolveKitchenZone(category: string | null): KitchenZone | null {
  switch ((category ?? "").trim().toLowerCase()) {
    case "пицца":
    case "пиццы":
      return "pizza";
    case "роллы":
    case "ролл":
    case "онигири":
    case "суши-доги":
      return "rolls";
    case "фастфуд":
    case "фаст фуд":
      return "fastfood";
    default:
      return null;
  }
}

export function normalizeKitchenZone(value: string): KitchenZone {
  return value === "pizza" || value === "rolls" || value === "fastfood" ? value : "fastfood";
}

export function mapOrderItem(
  row: OrderItemRow,
  packagingUsages: OrderPackagingUsage[],
): OrderItemSummary {
  return {
    id: row.id,
    catalogItemId: row.catalogItemId,
    itemName: row.itemName,
    quantity: row.quantity,
    unitPriceCents: row.unitPriceCents,
    totalPriceCents: row.totalPriceCents,
    catalogCategory: row.catalogCategory,
    kitchenZone: resolveKitchenZone(row.catalogCategory),
    packagingUsages,
  };
}

export function mapPackagingUsage(row: OrderPackagingUsageRow): OrderPackagingUsage {
  return {
    id: row.id,
    orderItemId: row.orderItemId,
    unitIndex: row.unitIndex,
    packageProductId: row.packageProductId,
    packageProductName: row.packageProductName,
    kitchenZone: normalizeKitchenZone(row.kitchenZone),
    createdAt: row.createdAt.toISOString(),
  };
}
