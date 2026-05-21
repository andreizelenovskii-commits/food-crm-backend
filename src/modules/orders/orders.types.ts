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

export type OrderSource = "SITE" | "PHONE" | "ADMIN";

export type OrderDraftItem = {
  catalogItemId: number;
  quantity: number;
  choices?: OrderDraftItemChoice[];
};

export type OrderDraftItemChoice = {
  choiceSlotId: number;
  selectedCatalogItemId: number;
};

export type OrderListItem = {
  id: number;
  status: OrderStatus;
  source: OrderSource;
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
  createdAt: string;
};

export type OrderCreateInput = {
  clientId: number;
  employeeId: number;
  isInternal: boolean;
  status: OrderStatus;
  deliveryFeeCents: number;
  source?: OrderSource;
  customerPhoneSnapshot?: string | null;
  deliveryAddressSnapshot?: string | null;
  customerComment?: string | null;
  items: OrderDraftItem[];
};
