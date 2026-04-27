import type { FastifyInstance } from "fastify";
import {
  addCatalogItem,
  deleteCatalogItemById,
  fetchCatalogItemById,
  fetchCatalogItems,
  updateCatalogItemById,
} from "@backend/modules/catalog/catalog.service";
import { parseCatalogItemInput } from "@backend/modules/catalog/catalog.validation";
import { requirePermission } from "@backend/modules/auth/auth-context";
import { getNumericParam, getRequestBody, toFormData } from "@backend/lib/request";

const CATALOG_FIELDS = [
  "name",
  "priceListType",
  "category",
  "description",
  "price",
  "technologicalCardId",
];

export async function registerCatalogRoutes(app: FastifyInstance) {
  app.get("/api/v1/catalog", { preHandler: requirePermission("view_catalog") }, async () => ({
    data: await fetchCatalogItems(),
  }));

  app.post("/api/v1/catalog", { preHandler: requirePermission("manage_catalog") }, async (request) => {
    const input = parseCatalogItemInput(toFormData(getRequestBody(request), CATALOG_FIELDS));
    return { data: await addCatalogItem(input) };
  });

  app.get("/api/v1/catalog/:itemId", { preHandler: requirePermission("view_catalog") }, async (request) => ({
    data: await fetchCatalogItemById(getNumericParam(request, "itemId")),
  }));

  app.patch("/api/v1/catalog/:itemId", { preHandler: requirePermission("manage_catalog") }, async (request) => {
    const input = parseCatalogItemInput(toFormData(getRequestBody(request), CATALOG_FIELDS));
    return { data: await updateCatalogItemById(getNumericParam(request, "itemId"), input) };
  });

  app.delete("/api/v1/catalog/:itemId", { preHandler: requirePermission("manage_catalog") }, async (request) => ({
    data: { deleted: await deleteCatalogItemById(getNumericParam(request, "itemId")) },
  }));
}
