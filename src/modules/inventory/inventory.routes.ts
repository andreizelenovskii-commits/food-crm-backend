import type { FastifyInstance } from "fastify";
import {
  addProduct,
  applyInventoryAuditService,
  closeInventorySessionService,
  completeIncomingActService,
  completeWriteoffActService,
  createIncomingActService,
  createInventorySessionService,
  createWriteoffActService,
  deleteIncomingActService,
  deleteInventorySessionService,
  deleteProductService,
  deleteWriteoffActService,
  fetchIncomingActById,
  fetchIncomingActs,
  fetchInventoryResponsibleOptions,
  fetchInventorySessionById,
  fetchInventorySessions,
  fetchProductById,
  fetchProducts,
  fetchWriteoffActs,
  saveInventorySessionActualsService,
  updateIncomingActService,
  updateProductService,
} from "@backend/modules/inventory/inventory.service";
import {
  parseCreateIncomingActInput,
  parseCreateInventorySessionInput,
  parseCreateWriteoffActInput,
  parseInventoryAuditInput,
  parseInventorySessionActualsInput,
  parseProductInput,
} from "@backend/modules/inventory/inventory.validation";
import { requirePermission } from "@backend/modules/auth/auth-context";
import { appendItems, getNumericParam, getRequestBody, toFormData } from "@backend/lib/request";

const PRODUCT_FIELDS = ["name", "category", "unit", "stockQuantity", "price", "description"];

function auditFormData(body: Record<string, unknown>) {
  const formData = new FormData();
  appendItems(formData, body.entries, {
    productId: "productId",
    actualQuantity: "actualQuantity",
  });
  return formData;
}

function sessionFormData(body: Record<string, unknown>) {
  const formData = toFormData(body, ["responsibleEmployeeId", "notes"]);
  const productIds = body.productIds;

  if (Array.isArray(productIds)) {
    for (const productId of productIds) {
      formData.append("productId", String(productId));
    }
  }

  return formData;
}

function sessionActualsFormData(body: Record<string, unknown>) {
  const formData = new FormData();
  appendItems(formData, body.items, {
    itemId: "itemId",
    actualQuantity: "actualQuantity",
  });
  return formData;
}

function writeoffActFormData(body: Record<string, unknown>) {
  const formData = toFormData(body, ["responsibleEmployeeId", "reason", "notes"]);
  appendItems(formData, body.items, {
    productId: "productId",
    quantity: "quantity",
  });
  return formData;
}

function incomingActFormData(body: Record<string, unknown>) {
  const formData = toFormData(body, ["responsibleEmployeeId", "supplierName", "notes"]);
  appendItems(formData, body.items, {
    productId: "productId",
    quantity: "quantity",
    price: "price",
  });
  return formData;
}

export async function registerInventoryRoutes(app: FastifyInstance) {
  app.get("/api/v1/inventory/products", { preHandler: requirePermission("view_inventory") }, async () => ({
    data: await fetchProducts(),
  }));

  app.post("/api/v1/inventory/products", { preHandler: requirePermission("manage_inventory") }, async (request) => {
    const input = parseProductInput(toFormData(getRequestBody(request), PRODUCT_FIELDS));
    return { data: await addProduct(input) };
  });

  app.get(
    "/api/v1/inventory/products/:productId",
    { preHandler: requirePermission("view_inventory") },
    async (request) => ({
      data: await fetchProductById(getNumericParam(request, "productId")),
    }),
  );

  app.patch(
    "/api/v1/inventory/products/:productId",
    { preHandler: requirePermission("manage_inventory") },
    async (request) => {
      const input = parseProductInput(toFormData(getRequestBody(request), PRODUCT_FIELDS));
      return { data: await updateProductService(getNumericParam(request, "productId"), input) };
    },
  );

  app.delete(
    "/api/v1/inventory/products/:productId",
    { preHandler: requirePermission("manage_inventory") },
    async (request) => ({
      data: { deleted: await deleteProductService(getNumericParam(request, "productId")) },
    }),
  );

  app.get("/api/v1/inventory/responsible-options", { preHandler: requirePermission("view_inventory") }, async () => ({
    data: await fetchInventoryResponsibleOptions(),
  }));

  app.post("/api/v1/inventory/audit", { preHandler: requirePermission("manage_inventory") }, async (request) => {
    const input = parseInventoryAuditInput(auditFormData(getRequestBody(request)));
    return { data: await applyInventoryAuditService(input) };
  });

  app.get("/api/v1/inventory/sessions", { preHandler: requirePermission("view_inventory") }, async () => ({
    data: await fetchInventorySessions(),
  }));

  app.post("/api/v1/inventory/sessions", { preHandler: requirePermission("manage_inventory") }, async (request) => {
    const input = parseCreateInventorySessionInput(sessionFormData(getRequestBody(request)));
    return { data: await createInventorySessionService(input) };
  });

  app.get(
    "/api/v1/inventory/sessions/:sessionId",
    { preHandler: requirePermission("view_inventory") },
    async (request) => ({
      data: await fetchInventorySessionById(getNumericParam(request, "sessionId")),
    }),
  );

  app.patch(
    "/api/v1/inventory/sessions/:sessionId/actuals",
    { preHandler: requirePermission("manage_inventory") },
    async (request) => {
      const input = parseInventorySessionActualsInput(sessionActualsFormData(getRequestBody(request)));
      return { data: await saveInventorySessionActualsService(getNumericParam(request, "sessionId"), input) };
    },
  );

  app.post(
    "/api/v1/inventory/sessions/:sessionId/close",
    { preHandler: requirePermission("manage_inventory") },
    async (request) => ({
      data: await closeInventorySessionService(getNumericParam(request, "sessionId")),
    }),
  );

  app.delete(
    "/api/v1/inventory/sessions/:sessionId",
    { preHandler: requirePermission("manage_inventory") },
    async (request) => ({
      data: { deleted: await deleteInventorySessionService(getNumericParam(request, "sessionId")) },
    }),
  );

  app.get("/api/v1/inventory/incoming-acts", { preHandler: requirePermission("view_inventory") }, async () => ({
    data: await fetchIncomingActs(),
  }));

  app.post("/api/v1/inventory/incoming-acts", { preHandler: requirePermission("manage_inventory") }, async (request) => {
    const input = parseCreateIncomingActInput(incomingActFormData(getRequestBody(request)));
    return { data: await createIncomingActService(input) };
  });

  app.get(
    "/api/v1/inventory/incoming-acts/:actId",
    { preHandler: requirePermission("view_inventory") },
    async (request) => ({
      data: await fetchIncomingActById(getNumericParam(request, "actId")),
    }),
  );

  app.patch(
    "/api/v1/inventory/incoming-acts/:actId",
    { preHandler: requirePermission("manage_inventory") },
    async (request) => {
      const input = parseCreateIncomingActInput(incomingActFormData(getRequestBody(request)));
      return { data: await updateIncomingActService(getNumericParam(request, "actId"), input) };
    },
  );

  app.post(
    "/api/v1/inventory/incoming-acts/:actId/complete",
    { preHandler: requirePermission("manage_inventory") },
    async (request) => ({
      data: await completeIncomingActService(getNumericParam(request, "actId")),
    }),
  );

  app.delete(
    "/api/v1/inventory/incoming-acts/:actId",
    { preHandler: requirePermission("manage_inventory") },
    async (request) => ({
      data: { deleted: await deleteIncomingActService(getNumericParam(request, "actId")) },
    }),
  );

  app.get("/api/v1/inventory/writeoff-acts", { preHandler: requirePermission("view_inventory") }, async () => ({
    data: await fetchWriteoffActs(),
  }));

  app.post("/api/v1/inventory/writeoff-acts", { preHandler: requirePermission("manage_inventory") }, async (request) => {
    const input = parseCreateWriteoffActInput(writeoffActFormData(getRequestBody(request)));
    return { data: await createWriteoffActService(input) };
  });

  app.post(
    "/api/v1/inventory/writeoff-acts/:actId/complete",
    { preHandler: requirePermission("manage_inventory") },
    async (request) => ({
      data: await completeWriteoffActService(getNumericParam(request, "actId")),
    }),
  );

  app.delete(
    "/api/v1/inventory/writeoff-acts/:actId",
    { preHandler: requirePermission("manage_inventory") },
    async (request) => ({
      data: { deleted: await deleteWriteoffActService(getNumericParam(request, "actId")) },
    }),
  );
}
