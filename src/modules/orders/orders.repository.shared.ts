import type {
  OrderListItem,
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
  };
}
