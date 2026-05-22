import type {
  IncomingActItem,
  IncomingActSummary,
  InventorySession,
  InventorySessionItem,
  ProductItem,
  WriteoffActItem,
  WriteoffActSummary,
  WriteoffReason,
} from "@backend/modules/inventory/inventory.types";
import type {
  IncomingActItemRow,
  IncomingActRow,
  InventorySessionItemRow,
  InventorySessionRow,
  ProductRow,
  WriteoffActItemRow,
  WriteoffActRow,
} from "@backend/modules/inventory/inventory.repository.rows";

export function mapRowToProduct(row: ProductRow): ProductItem {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    category: row.category,
    kitchenZone: row.kitchenZone,
    unit: row.unit,
    stockQuantity: row.stockQuantity,
    priceCents: row.priceCents,
    description: row.description,
    orderItemsCount: Number(row.orderItemsCount ?? 0),
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapInventorySessionItem(row: InventorySessionItemRow): InventorySessionItem {
  const varianceQuantity =
    row.actualQuantity === null ? null : row.actualQuantity - row.currentStockQuantity;

  return {
    id: row.id,
    productId: row.productId,
    productName: row.productName,
    productCategory: row.productCategory,
    productUnit: row.productUnit,
    stockQuantity: row.stockQuantity,
    currentStockQuantity: row.currentStockQuantity,
    actualQuantity: row.actualQuantity,
    priceCents: row.priceCents,
    varianceQuantity,
    varianceValueCents: varianceQuantity === null ? null : varianceQuantity * row.priceCents,
  };
}

export function mapInventorySession(
  row: InventorySessionRow,
  items: InventorySessionItem[],
): InventorySession {
  return {
    id: row.id,
    responsibleEmployeeId: row.responsibleEmployeeId,
    responsibleEmployeeName: row.responsibleEmployeeName,
    responsibleEmployeeRole: row.responsibleEmployeeRole,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    isClosed: Boolean(row.closedAt),
    items,
  };
}

export function mapIncomingActItem(row: IncomingActItemRow): IncomingActItem {
  return {
    id: row.id,
    productId: row.productId,
    productName: row.productName,
    productCategory: row.productCategory,
    productUnit: row.productUnit,
    quantity: row.quantity,
    priceCents: row.priceCents,
    totalCents: row.quantity * row.priceCents,
    currentStockQuantity: row.currentStockQuantity,
    stockQuantityBefore: row.stockQuantityBefore,
    stockQuantityAfter: row.stockQuantityAfter,
  };
}

export function calculateWeightedAveragePriceCents(
  currentStockQuantity: number,
  currentPriceCents: number,
  incomingQuantity: number,
  incomingPriceCents: number,
) {
  if (incomingQuantity <= 0) {
    return currentPriceCents;
  }

  if (currentStockQuantity <= 0 || currentPriceCents <= 0) {
    return incomingPriceCents;
  }

  const totalQuantity = currentStockQuantity + incomingQuantity;

  if (totalQuantity <= 0) {
    return incomingPriceCents;
  }

  const totalValueCents =
    currentStockQuantity * currentPriceCents + incomingQuantity * incomingPriceCents;

  return Math.round(totalValueCents / totalQuantity);
}

export function mapIncomingAct(row: IncomingActRow, items: IncomingActItem[]): IncomingActSummary {
  return {
    id: row.id,
    responsibleEmployeeId: row.responsibleEmployeeId,
    responsibleEmployeeName: row.responsibleEmployeeName,
    responsibleEmployeeRole: row.responsibleEmployeeRole,
    supplierName: row.supplierName,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    isCompleted: Boolean(row.completedAt),
    itemsCount: Number(row.itemsCount ?? items.length),
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    totalCents: items.reduce((sum, item) => sum + item.totalCents, 0),
    items,
  };
}

export function mapWriteoffActItem(row: WriteoffActItemRow): WriteoffActItem {
  return {
    id: row.id,
    productId: row.productId,
    productName: row.productName,
    productCategory: row.productCategory,
    productUnit: row.productUnit,
    quantity: row.quantity,
    priceCents: row.priceCents,
    totalCents: row.quantity * row.priceCents,
    currentStockQuantity: row.currentStockQuantity,
    stockQuantityBefore: row.stockQuantityBefore,
    stockQuantityAfter: row.stockQuantityAfter,
  };
}

export function mapWriteoffAct(row: WriteoffActRow, items: WriteoffActItem[]): WriteoffActSummary {
  return {
    id: row.id,
    responsibleEmployeeId: row.responsibleEmployeeId,
    responsibleEmployeeName: row.responsibleEmployeeName,
    responsibleEmployeeRole: row.responsibleEmployeeRole,
    reason: row.reason as WriteoffReason,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    isCompleted: Boolean(row.completedAt),
    itemsCount: Number(row.itemsCount ?? items.length),
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    totalCents: items.reduce((sum, item) => sum + item.totalCents, 0),
    items,
  };
}
