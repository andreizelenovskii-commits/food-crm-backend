import type {
  ProductCategory,
  WriteoffReason,
} from "@backend/modules/inventory/inventory.types";

export type ProductInput = {
  name: string;
  category: ProductCategory;
  unit: "кг" | "шт";
  stockQuantity: number;
  priceCents: number;
  description: string | null;
};

export type InventoryAuditEntryInput = {
  productId: number;
  actualQuantity: number;
};

export type CreateInventorySessionInput = {
  responsibleEmployeeId: number;
  notes: string | null;
  productIds: number[];
};

export type InventorySessionActualInput = {
  itemId: number;
  actualQuantity: number | null;
};

export type CreateWriteoffActInput = {
  responsibleEmployeeId: number;
  reason: WriteoffReason;
  notes: string | null;
  items: Array<{
    productId: number;
    quantity: number;
  }>;
};

export type CreateIncomingActInput = {
  responsibleEmployeeId: number;
  supplierName: string | null;
  notes: string | null;
  items: Array<{
    productId: number;
    quantity: number;
    priceCents: number;
  }>;
};
