import {
  createCatalogItem,
  deleteCatalogItem,
  getCatalogItemById,
  getCatalogItems,
  getPublicCatalogItems,
  updateCatalogItem,
} from "@backend/modules/catalog/catalog.repository";
import type { CatalogItemInput } from "@backend/modules/catalog/catalog.validation";

export async function fetchCatalogItems() {
  return getCatalogItems();
}

export async function fetchPublicCatalogItems() {
  return getPublicCatalogItems();
}

export async function fetchCatalogItemById(id: number) {
  return getCatalogItemById(id);
}

export async function addCatalogItem(input: CatalogItemInput) {
  return createCatalogItem(input);
}

export async function updateCatalogItemById(id: number, input: CatalogItemInput) {
  return updateCatalogItem(id, input);
}

export async function deleteCatalogItemById(id: number) {
  return deleteCatalogItem(id);
}
