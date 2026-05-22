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
  catalogItemVariantId?: number;
  excludedIngredientIds?: number[];
  quantity: number;
  choices?: OrderDraftItemChoice[];
};

export type OrderDraftItemChoice = {
  choiceSlotId: number;
  selectedCatalogItemId: number;
};

export type KitchenZone = "pizza" | "rolls" | "fastfood";

export type OrderPackagingUsage = {
  id: number;
  orderItemId: number;
  unitIndex: number;
  packageProductId: number;
  packageProductName: string;
  kitchenZone: KitchenZone;
  createdAt: string;
};

export type OrderItemExcludedIngredient = {
  id: number;
  productId: number;
  label: string;
};

export type OrderItemSummary = {
  id: number;
  catalogItemId: number | null;
  catalogItemVariantId: number | null;
  itemName: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
  catalogCategory: string | null;
  kitchenZone: KitchenZone | null;
  excludedIngredients: OrderItemExcludedIngredient[];
  packagingUsages: OrderPackagingUsage[];
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
  items: OrderItemSummary[];
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
