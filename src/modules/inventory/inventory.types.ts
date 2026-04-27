export const PRODUCT_CATEGORIES = [
  "Молокосодержащая продукция",
  "Мясная и куриная продукция",
  "Соуса",
  "Сиропы",
  "Овощи и фрукты",
  "Колбасная продукция",
  "Морепродукты",
  "Приправы и специи",
  "Упаковка",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const WRITEOFF_REASONS = [
  "Брак",
  "Порча",
  "Просрочка",
  "Внутренний расход",
  "Недостача",
  "Другое",
] as const;

export type WriteoffReason = (typeof WRITEOFF_REASONS)[number];

export type ProductItem = {
  id: number;
  name: string;
  sku: string | null;
  category: ProductCategory | null;
  unit: string;
  stockQuantity: number;
  priceCents: number;
  description: string | null;
  orderItemsCount: number;
  createdAt: string;
};

export type InventoryResponsibleOption = {
  id: number;
  name: string;
  role: string;
};

export type IncomingActItem = {
  id: number;
  productId: number;
  productName: string;
  productCategory: string | null;
  productUnit: string;
  quantity: number;
  priceCents: number;
  totalCents: number;
  currentStockQuantity: number;
  stockQuantityBefore: number | null;
  stockQuantityAfter: number | null;
};

export type IncomingActSummary = {
  id: number;
  responsibleEmployeeId: number;
  responsibleEmployeeName: string;
  responsibleEmployeeRole: string;
  supplierName: string | null;
  notes: string | null;
  createdAt: string;
  completedAt: string | null;
  isCompleted: boolean;
  itemsCount: number;
  totalQuantity: number;
  totalCents: number;
  items: IncomingActItem[];
};

export type InventorySessionItem = {
  id: number;
  productId: number;
  productName: string;
  productCategory: string | null;
  productUnit: string;
  stockQuantity: number;
  currentStockQuantity: number;
  actualQuantity: number | null;
  priceCents: number;
  varianceQuantity: number | null;
  varianceValueCents: number | null;
};

export type InventorySessionItemSummary = {
  id: number;
  productId: number;
  productName: string;
  productCategory: string | null;
  productUnit: string;
  stockQuantity: number;
  currentStockQuantity: number;
  actualQuantity: number | null;
  priceCents: number;
  varianceQuantity: number | null;
  varianceValueCents: number | null;
};

export type InventorySession = {
  id: number;
  responsibleEmployeeId: number;
  responsibleEmployeeName: string;
  responsibleEmployeeRole: string;
  notes: string | null;
  createdAt: string;
  closedAt: string | null;
  isClosed: boolean;
  items: InventorySessionItem[];
};

export type InventorySessionSummary = {
  id: number;
  responsibleEmployeeId: number;
  responsibleEmployeeName: string;
  responsibleEmployeeRole: string;
  notes: string | null;
  createdAt: string;
  closedAt: string | null;
  isClosed: boolean;
  itemsCount: number;
  totalQuantity: number;
  categories: string[];
  items: InventorySessionItemSummary[];
};

export type WriteoffActItem = {
  id: number;
  productId: number;
  productName: string;
  productCategory: string | null;
  productUnit: string;
  quantity: number;
  priceCents: number;
  totalCents: number;
  currentStockQuantity: number;
  stockQuantityBefore: number | null;
  stockQuantityAfter: number | null;
};

export type WriteoffActSummary = {
  id: number;
  responsibleEmployeeId: number;
  responsibleEmployeeName: string;
  responsibleEmployeeRole: string;
  reason: WriteoffReason;
  notes: string | null;
  createdAt: string;
  completedAt: string | null;
  isCompleted: boolean;
  itemsCount: number;
  totalQuantity: number;
  totalCents: number;
  items: WriteoffActItem[];
};
