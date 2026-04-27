import type {
  IncomingActSummary,
  InventoryResponsibleOption,
  InventorySession,
  InventorySessionSummary,
  ProductItem,
  WriteoffActSummary,
} from "@backend/modules/inventory/inventory.types";
import type {
  CreateIncomingActInput,
  CreateInventorySessionInput,
  CreateWriteoffActInput,
  InventoryAuditEntryInput,
  InventorySessionActualInput,
  ProductInput,
} from "@backend/modules/inventory/inventory.validation";
import {
  applyInventoryAudit,
  closeInventorySession,
  completeIncomingAct,
  completeWriteoffAct,
  createIncomingAct,
  createInventorySession,
  createWriteoffAct,
  createProduct,
  deleteWriteoffAct,
  deleteIncomingAct,
  deleteInventorySession,
  deleteProduct,
  getIncomingActById,
  getInventoryResponsibleOptions,
  getIncomingActs,
  getInventorySessionById,
  getInventorySessions,
  getWriteoffActs,
  getProductById,
  getProducts,
  saveInventorySessionActuals,
  type InventoryAuditResult,
  updateIncomingAct,
  updateProduct,
} from "@backend/modules/inventory/inventory.repository";

export async function fetchProducts(): Promise<ProductItem[]> {
  return getProducts();
}

export async function fetchInventoryResponsibleOptions(): Promise<InventoryResponsibleOption[]> {
  return getInventoryResponsibleOptions();
}

export async function fetchIncomingActs(): Promise<IncomingActSummary[]> {
  return getIncomingActs();
}

export async function fetchIncomingActById(
  actId: number,
): Promise<IncomingActSummary | null> {
  return getIncomingActById(actId);
}

export async function fetchInventorySessions(): Promise<InventorySessionSummary[]> {
  return getInventorySessions();
}

export async function fetchInventorySessionById(
  sessionId: number,
): Promise<InventorySessionSummary | null> {
  return getInventorySessionById(sessionId);
}

export async function fetchWriteoffActs(): Promise<WriteoffActSummary[]> {
  return getWriteoffActs();
}

export async function fetchProductById(productId: number): Promise<ProductItem | null> {
  return getProductById(productId);
}

export async function addProduct(input: ProductInput): Promise<ProductItem> {
  return createProduct(input);
}

export async function updateProductService(
  productId: number,
  input: ProductInput,
): Promise<ProductItem | null> {
  return updateProduct(productId, input);
}

export async function deleteProductService(productId: number): Promise<boolean> {
  return deleteProduct(productId);
}

export async function applyInventoryAuditService(
  entries: InventoryAuditEntryInput[],
): Promise<InventoryAuditResult> {
  return applyInventoryAudit(entries);
}

export async function createInventorySessionService(
  input: CreateInventorySessionInput,
): Promise<InventorySession> {
  return createInventorySession(input);
}

export async function createIncomingActService(
  input: CreateIncomingActInput,
): Promise<IncomingActSummary> {
  return createIncomingAct(input);
}

export async function updateIncomingActService(
  actId: number,
  input: CreateIncomingActInput,
): Promise<IncomingActSummary> {
  return updateIncomingAct(actId, input);
}

export async function createWriteoffActService(
  input: CreateWriteoffActInput,
): Promise<WriteoffActSummary> {
  return createWriteoffAct(input);
}

export async function saveInventorySessionActualsService(
  sessionId: number,
  entries: InventorySessionActualInput[],
) {
  return saveInventorySessionActuals(sessionId, entries);
}

export async function closeInventorySessionService(sessionId: number) {
  return closeInventorySession(sessionId);
}

export async function completeIncomingActService(actId: number) {
  return completeIncomingAct(actId);
}

export async function deleteInventorySessionService(sessionId: number) {
  return deleteInventorySession(sessionId);
}

export async function completeWriteoffActService(actId: number) {
  return completeWriteoffAct(actId);
}

export async function deleteWriteoffActService(actId: number) {
  return deleteWriteoffAct(actId);
}

export async function deleteIncomingActService(actId: number) {
  return deleteIncomingAct(actId);
}
