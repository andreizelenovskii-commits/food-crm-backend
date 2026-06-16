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
  fetchTechCardProductOptions,
  fetchTechCards,
} from "@backend/modules/tech-cards/tech-cards.service";
import { fetchEmployees } from "@backend/modules/employees/employees.service";
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
import { writeAuditLog } from "@backend/modules/audit/audit-log";

const PRODUCT_FIELDS = ["name", "category", "kitchenZone", "unit", "stockQuantity", "price", "description"];

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
  app.get("/api/v1/inventory/workspace", { preHandler: requirePermission("view_inventory") }, async () => {
    const [
      products,
      responsibleOptions,
      incomingActs,
      inventorySessions,
      writeoffActs,
      employees,
      techCards,
      techCardProducts,
    ] = await Promise.all([
      fetchProducts(),
      fetchInventoryResponsibleOptions(),
      fetchIncomingActs(),
      fetchInventorySessions(),
      fetchWriteoffActs(),
      fetchEmployees(),
      fetchTechCards(),
      fetchTechCardProductOptions(),
    ]);

    return {
      data: {
        products,
        responsibleOptions,
        incomingActs,
        inventorySessions,
        writeoffActs,
        employees,
        techCards,
        techCardProducts,
      },
    };
  });

  app.get("/api/v1/inventory/products", { preHandler: requirePermission("view_inventory") }, async () => ({
    data: await fetchProducts(),
  }));

  app.post("/api/v1/inventory/products", { preHandler: requirePermission("manage_inventory") }, async (request) => {
    const input = parseProductInput(toFormData(getRequestBody(request), PRODUCT_FIELDS));
    const product = await addProduct(input);
    await writeAuditLog({
      request,
      action: "product.create",
      entityType: "product",
      entityId: product.id,
      after: product,
    });
    return { data: product };
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
      const productId = getNumericParam(request, "productId");
      const before = await fetchProductById(productId);
      const input = parseProductInput(toFormData(getRequestBody(request), PRODUCT_FIELDS));
      const product = await updateProductService(productId, input);
      await writeAuditLog({
        request,
        action: "product.update",
        entityType: "product",
        entityId: productId,
        before,
        after: product,
      });
      return { data: product };
    },
  );

  app.delete(
    "/api/v1/inventory/products/:productId",
    { preHandler: requirePermission("manage_inventory") },
    async (request) => {
      const productId = getNumericParam(request, "productId");
      const before = await fetchProductById(productId);
      const deleted = await deleteProductService(productId);
      await writeAuditLog({
        request,
        action: "product.delete",
        entityType: "product",
        entityId: productId,
        before,
        after: { deleted },
      });
      return { data: { deleted } };
    },
  );

  app.get("/api/v1/inventory/responsible-options", { preHandler: requirePermission("view_inventory") }, async () => ({
    data: await fetchInventoryResponsibleOptions(),
  }));

  app.post("/api/v1/inventory/audit", { preHandler: requirePermission("manage_inventory") }, async (request) => {
    const input = parseInventoryAuditInput(auditFormData(getRequestBody(request)));
    const result = await applyInventoryAuditService(input);
    await writeAuditLog({
      request,
      action: "inventory.audit.apply",
      entityType: "inventory",
      after: { input, result },
    });
    return { data: result };
  });

  app.get("/api/v1/inventory/sessions", { preHandler: requirePermission("view_inventory") }, async () => ({
    data: await fetchInventorySessions(),
  }));

  app.post("/api/v1/inventory/sessions", { preHandler: requirePermission("manage_inventory") }, async (request) => {
    const input = parseCreateInventorySessionInput(sessionFormData(getRequestBody(request)));
    const session = await createInventorySessionService(input);
    await writeAuditLog({
      request,
      action: "inventory_session.create",
      entityType: "inventory_session",
      entityId: session.id,
      after: session,
    });
    return { data: session };
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
      const sessionId = getNumericParam(request, "sessionId");
      const before = await fetchInventorySessionById(sessionId);
      const input = parseInventorySessionActualsInput(sessionActualsFormData(getRequestBody(request)));
      const session = await saveInventorySessionActualsService(sessionId, input);
      await writeAuditLog({
        request,
        action: "inventory_session.actuals.update",
        entityType: "inventory_session",
        entityId: sessionId,
        before,
        after: session,
      });
      return { data: session };
    },
  );

  app.post(
    "/api/v1/inventory/sessions/:sessionId/close",
    { preHandler: requirePermission("manage_inventory") },
    async (request) => {
      const sessionId = getNumericParam(request, "sessionId");
      const before = await fetchInventorySessionById(sessionId);
      const session = await closeInventorySessionService(sessionId);
      await writeAuditLog({
        request,
        action: "inventory_session.close",
        entityType: "inventory_session",
        entityId: sessionId,
        before,
        after: session,
      });
      return { data: session };
    },
  );

  app.delete(
    "/api/v1/inventory/sessions/:sessionId",
    { preHandler: requirePermission("manage_inventory") },
    async (request) => {
      const sessionId = getNumericParam(request, "sessionId");
      const before = await fetchInventorySessionById(sessionId);
      const deleted = await deleteInventorySessionService(sessionId);
      await writeAuditLog({
        request,
        action: "inventory_session.delete",
        entityType: "inventory_session",
        entityId: sessionId,
        before,
        after: { deleted },
      });
      return { data: { deleted } };
    },
  );

  app.get("/api/v1/inventory/incoming-acts", { preHandler: requirePermission("view_inventory") }, async () => ({
    data: await fetchIncomingActs(),
  }));

  app.post("/api/v1/inventory/incoming-acts", { preHandler: requirePermission("manage_inventory") }, async (request) => {
    const input = parseCreateIncomingActInput(incomingActFormData(getRequestBody(request)));
    const act = await createIncomingActService(input);
    await writeAuditLog({
      request,
      action: "incoming_act.create",
      entityType: "incoming_act",
      entityId: act.id,
      after: act,
    });
    return { data: act };
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
      const actId = getNumericParam(request, "actId");
      const before = await fetchIncomingActById(actId);
      const input = parseCreateIncomingActInput(incomingActFormData(getRequestBody(request)));
      const act = await updateIncomingActService(actId, input);
      await writeAuditLog({
        request,
        action: "incoming_act.update",
        entityType: "incoming_act",
        entityId: actId,
        before,
        after: act,
      });
      return { data: act };
    },
  );

  app.post(
    "/api/v1/inventory/incoming-acts/:actId/complete",
    { preHandler: requirePermission("manage_inventory") },
    async (request) => {
      const actId = getNumericParam(request, "actId");
      const before = await fetchIncomingActById(actId);
      const act = await completeIncomingActService(actId);
      await writeAuditLog({
        request,
        action: "incoming_act.complete",
        entityType: "incoming_act",
        entityId: actId,
        before,
        after: act,
      });
      return { data: act };
    },
  );

  app.delete(
    "/api/v1/inventory/incoming-acts/:actId",
    { preHandler: requirePermission("manage_inventory") },
    async (request) => {
      const actId = getNumericParam(request, "actId");
      const before = await fetchIncomingActById(actId);
      const deleted = await deleteIncomingActService(actId);
      await writeAuditLog({
        request,
        action: "incoming_act.delete",
        entityType: "incoming_act",
        entityId: actId,
        before,
        after: { deleted },
      });
      return { data: { deleted } };
    },
  );

  app.get("/api/v1/inventory/writeoff-acts", { preHandler: requirePermission("view_inventory") }, async () => ({
    data: await fetchWriteoffActs(),
  }));

  app.post("/api/v1/inventory/writeoff-acts", { preHandler: requirePermission("manage_inventory") }, async (request) => {
    const input = parseCreateWriteoffActInput(writeoffActFormData(getRequestBody(request)));
    const act = await createWriteoffActService(input);
    await writeAuditLog({
      request,
      action: "writeoff_act.create",
      entityType: "writeoff_act",
      entityId: act.id,
      after: act,
    });
    return { data: act };
  });

  app.post(
    "/api/v1/inventory/writeoff-acts/:actId/complete",
    { preHandler: requirePermission("manage_inventory") },
    async (request) => {
      const actId = getNumericParam(request, "actId");
      const act = await completeWriteoffActService(actId);
      await writeAuditLog({
        request,
        action: "writeoff_act.complete",
        entityType: "writeoff_act",
        entityId: actId,
        after: act,
      });
      return { data: act };
    },
  );

  app.delete(
    "/api/v1/inventory/writeoff-acts/:actId",
    { preHandler: requirePermission("manage_inventory") },
    async (request) => {
      const actId = getNumericParam(request, "actId");
      const deleted = await deleteWriteoffActService(actId);
      await writeAuditLog({
        request,
        action: "writeoff_act.delete",
        entityType: "writeoff_act",
        entityId: actId,
        after: { deleted },
      });
      return { data: { deleted } };
    },
  );
}
