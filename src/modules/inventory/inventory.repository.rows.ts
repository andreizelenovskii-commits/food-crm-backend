import type { ProductCategory } from "@backend/modules/inventory/inventory.types";

export type ProductRow = {
  id: number;
  name: string;
  sku: string | null;
  category: ProductCategory | null;
  unit: string;
  stockQuantity: number;
  priceCents: number;
  description: string | null;
  orderItemsCount?: string;
  createdAt: Date;
};

export type InventorySessionRow = {
  id: number;
  responsibleEmployeeId: number;
  responsibleEmployeeName: string;
  responsibleEmployeeRole: string;
  notes: string | null;
  createdAt: Date;
  closedAt: Date | null;
  itemsCount?: string;
};

export type IncomingActRow = {
  id: number;
  responsibleEmployeeId: number;
  responsibleEmployeeName: string;
  responsibleEmployeeRole: string;
  supplierName: string | null;
  notes: string | null;
  createdAt: Date;
  completedAt: Date | null;
  itemsCount?: string;
};

export type IncomingActItemRow = {
  id: number;
  incomingActId: number;
  productId: number;
  productName: string;
  productCategory: string | null;
  productUnit: string;
  quantity: number;
  priceCents: number;
  currentStockQuantity: number;
  stockQuantityBefore: number | null;
  stockQuantityAfter: number | null;
};

export type InventorySessionItemRow = {
  id: number;
  inventorySessionId: number;
  productId: number;
  productName: string;
  productCategory: string | null;
  productUnit: string;
  stockQuantity: number;
  currentStockQuantity: number;
  actualQuantity: number | null;
  priceCents: number;
};

export type WriteoffActRow = {
  id: number;
  responsibleEmployeeId: number;
  responsibleEmployeeName: string;
  responsibleEmployeeRole: string;
  reason: string;
  notes: string | null;
  createdAt: Date;
  completedAt: Date | null;
  itemsCount?: string;
};

export type WriteoffActItemRow = {
  id: number;
  writeoffActId: number;
  productId: number;
  productName: string;
  productCategory: string | null;
  productUnit: string;
  quantity: number;
  priceCents: number;
  currentStockQuantity: number;
  stockQuantityBefore: number | null;
  stockQuantityAfter: number | null;
};

export const PRODUCT_SKU_SQL =
  `COALESCE(p."sku", CONCAT('PRD-', LPAD(p."id"::text, 5, '0')))` as const;
