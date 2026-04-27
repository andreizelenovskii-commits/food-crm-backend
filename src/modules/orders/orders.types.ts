export type OrderStatus =
  | "SENT_TO_KITCHEN"
  | "READY"
  | "PACKED"
  | "DELIVERED_PAID"
  | "CANCELLED";

export const ORDER_STATUSES = [
  "SENT_TO_KITCHEN",
  "READY",
  "PACKED",
  "DELIVERED_PAID",
  "CANCELLED",
] as const;

export type OrderDraftItem = {
  catalogItemId: number;
  quantity: number;
};

export type OrderListItem = {
  id: number;
  status: OrderStatus;
  isInternal: boolean;
  clientId: number;
  clientName: string;
  clientType: "CLIENT" | "ORGANIZATION";
  employeeId: number;
  employeeName: string;
  subtotalCents: number;
  discountPercent: number;
  totalCents: number;
  createdAt: string;
};

export type OrderCreateInput = {
  clientId: number;
  employeeId: number;
  isInternal: boolean;
  status: OrderStatus;
  deliveryFeeCents: number;
  items: OrderDraftItem[];
};
