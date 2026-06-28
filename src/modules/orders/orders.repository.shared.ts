import type {
  KitchenZone,
  OrderItemSummary,
  OrderItemExcludedIngredient,
  OrderListItem,
  OrderPackagingUsage,
  OrderSource,
  OrderStatus,
} from "@backend/modules/orders/orders.types";

export type OrderRow = {
  id: number;
  status: string;
  shiftId: number | null;
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

export type CatalogVariantOrderRow = {
  id: number;
  catalogItemId: number;
  technologicalCardId: number;
  label: string;
  priceCents: number;
  pizzaSize: string | null;
  rollSize: string | null;
};

export type OrderItemRow = {
  id: number;
  orderId: number;
  catalogItemId: number | null;
  catalogItemVariantId: number | null;
  itemName: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
  catalogCategory: string | null;
  kitchenZone: string | null;
  kitchenZones: string[];
};

export type OrderItemExcludedIngredientRow = {
  id: number;
  orderItemId: number;
  productId: number;
  label: string;
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
    case "NEW":
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
    shiftId: row.shiftId,
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
    case "холодные роллы":
    case "запеченные роллы":
    case "теплые роллы":
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
  return value === "pizza" || value === "rolls" || value === "fastfood" || value === "dispatch" ? value : "fastfood";
}

function resolveOrderKitchenZone(value: string | null, category: string | null) {
  return value === "pizza" || value === "rolls" || value === "fastfood" || value === "dispatch"
    ? value
    : resolveKitchenZone(category);
}

function resolveOrderKitchenZones(values: string[], value: string | null, category: string | null) {
  const normalized = values.filter(
    (zone): zone is KitchenZone =>
      zone === "pizza" || zone === "rolls" || zone === "fastfood" || zone === "dispatch",
  );

  if (normalized.length) {
    return normalized;
  }

  const fallback = resolveOrderKitchenZone(value, category);
  return fallback ? [fallback] : [];
}

export function mapOrderItem(
  row: OrderItemRow,
  packagingUsages: OrderPackagingUsage[],
  excludedIngredients: OrderItemExcludedIngredient[] = [],
): OrderItemSummary {
  return {
    id: row.id,
    catalogItemId: row.catalogItemId,
    catalogItemVariantId: row.catalogItemVariantId,
    itemName: row.itemName,
    quantity: row.quantity,
    unitPriceCents: row.unitPriceCents,
    totalPriceCents: row.totalPriceCents,
    catalogCategory: row.catalogCategory,
    kitchenZone: resolveOrderKitchenZone(row.kitchenZone, row.catalogCategory),
    kitchenZones: resolveOrderKitchenZones(row.kitchenZones, row.kitchenZone, row.catalogCategory),
    excludedIngredients,
    packagingUsages,
  };
}

export function mapExcludedIngredient(row: OrderItemExcludedIngredientRow): OrderItemExcludedIngredient {
  return {
    id: row.id,
    productId: row.productId,
    label: row.label,
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
