import type { FastifyInstance } from "fastify";
import { getCatalogUpload, saveCatalogUpload } from "@backend/modules/catalog/catalog.uploads";
import {
  addCatalogItem,
  deleteCatalogItemById,
  fetchCatalogItemById,
  fetchCatalogItems,
  fetchPublicCatalogItems,
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
  "imageUrl",
  "price",
  "technologicalCardId",
];

export async function registerCatalogRoutes(app: FastifyInstance) {
  app.addContentTypeParser(
    /^multipart\/form-data/i,
    { parseAs: "buffer", bodyLimit: 6 * 1024 * 1024 },
    (_request, body, done) => {
      done(null, body);
    },
  );

  app.get("/api/v1/catalog", { preHandler: requirePermission("view_catalog") }, async () => ({
    data: await fetchCatalogItems(),
  }));

  app.get("/api/v1/public/catalog", async () => ({
    data: await fetchPublicCatalogItems(),
  }));

  app.get("/uploads/catalog/:filename", async (request, reply) => {
    const filename = (request.params as { filename?: string }).filename ?? "";
    const upload = getCatalogUpload(filename);

    return reply.type(upload.contentType).send(upload.stream);
  });

  app.post(
    "/api/v1/catalog/uploads",
    { preHandler: requirePermission("manage_catalog") },
    async (request) => ({
      data: await saveCatalogUpload(request),
    }),
  );

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
