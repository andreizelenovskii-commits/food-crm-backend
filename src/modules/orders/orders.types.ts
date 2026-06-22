export type OrderStatus =
  | "NEW"
  | "SENT_TO_KITCHEN"
  | "READY"
  | "PACKED"
  | "DELIVERED_PAID"
  | "CANCELLED";

export const ORDER_STATUSES = [
  "NEW",
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
  position?: number;
  selectedCatalogItemId: number;
  selectedCatalogItemVariantId?: number;
};

export type KitchenZone = "pizza" | "rolls" | "fastfood" | "dispatch";

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
  kitchenZones: KitchenZone[];
  excludedIngredients: OrderItemExcludedIngredient[];
  packagingUsages: OrderPackagingUsage[];
};

export type KitchenOrderItemSummary = Pick<
  OrderItemSummary,
  | "id"
  | "catalogItemId"
  | "catalogItemVariantId"
  | "itemName"
  | "quantity"
  | "catalogCategory"
  | "kitchenZone"
  | "kitchenZones"
  | "excludedIngredients"
  | "packagingUsages"
>;

export type OrderListItem = {
  id: number;
  status: OrderStatus;
  shiftId: number | null;
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

export type KitchenOrderListItem = Pick<
  OrderListItem,
  | "id"
  | "status"
  | "source"
  | "isInternal"
  | "employeeId"
  | "employeeName"
  | "customerComment"
  | "createdAt"
> & {
  items: KitchenOrderItemSummary[];
};

export type OrderCreateInput = {
  clientId: number;
  employeeId: number;
  isInternal: boolean;
  status: OrderStatus;
  shiftId?: number | null;
  deliveryFeeCents: number;
  source?: OrderSource;
  customerPhoneSnapshot?: string | null;
  deliveryAddressSnapshot?: string | null;
  customerComment?: string | null;
  items: OrderDraftItem[];
};
