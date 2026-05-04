import type {
  OrderListItem,
  OrderStatus,
} from "@backend/modules/orders/orders.types";

export type OrderRow = {
  id: number;
  status: string;
  isInternal: boolean;
  clientId: number;
  clientName: string;
  clientType: "CLIENT" | "ORGANIZATION";
  employeeId: number;
  employeeName: string;
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

export function mapRowToOrder(row: OrderRow): OrderListItem {
  return {
    id: row.id,
    status: normalizeDbOrderStatus(row.status),
    isInternal: row.isInternal,
    clientId: row.clientId,
    clientName: row.clientName,
    clientType: row.clientType,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    subtotalCents: row.subtotalCents,
    discountPercent: row.discountPercent,
    totalCents: row.totalCents,
    createdAt: row.createdAt.toISOString(),
  };
}
