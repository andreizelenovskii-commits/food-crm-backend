import type { FastifyInstance } from "fastify";
import {
  addClient,
  deleteClientService,
  fetchClientById,
  fetchClientByPhone,
  fetchClients,
  updateClientService,
} from "@backend/modules/clients/clients.service";
import { parseCreateClientInput, parseUpdateClientInput } from "@backend/modules/clients/clients.validation";
import { authenticateRequest, requirePermission } from "@backend/modules/auth/auth-context";
import { getNumericParam, getRequestBody, toFormData } from "@backend/lib/request";
import { writeAuditLog } from "@backend/modules/audit/audit-log";

const CLIENT_FIELDS = [
  "name",
  "type",
  "email",
  "phone",
  "birthDate",
  "addressResidenceType",
  "addressCity",
  "addressStreet",
  "addressHouse",
  "addressEntrance",
  "addressFloor",
  "addressApartment",
  "addressesJson",
  "notes",
  "loyaltyLevelOverride",
];

export async function registerClientsRoutes(app: FastifyInstance) {
  app.get("/api/v1/clients", { preHandler: requirePermission("view_clients") }, async () => ({
    data: await fetchClients(),
  }));

  app.post("/api/v1/clients", { preHandler: requirePermission("manage_clients") }, async (request) => {
    const input = parseCreateClientInput(toFormData(getRequestBody(request), CLIENT_FIELDS));
    const client = await addClient(input);
    await writeAuditLog({
      request,
      action: "client.create",
      entityType: "client",
      entityId: client.id,
      after: client,
    });
    return { data: client };
  });

  app.get("/api/v1/clients/me", { preHandler: authenticateRequest }, async (request) => ({
    data: request.authUser?.phone ? await fetchClientByPhone(request.authUser.phone) : null,
  }));

  app.get("/api/v1/clients/:clientId", { preHandler: requirePermission("view_clients") }, async (request) => ({
    data: await fetchClientById(getNumericParam(request, "clientId")),
  }));

  app.patch("/api/v1/clients/:clientId", { preHandler: requirePermission("manage_clients") }, async (request) => {
    const clientId = getNumericParam(request, "clientId");
    const before = await fetchClientById(clientId);
    const input = parseUpdateClientInput(toFormData(getRequestBody(request), CLIENT_FIELDS));
    const client = await updateClientService(clientId, input);
    await writeAuditLog({
      request,
      action: "client.update",
      entityType: "client",
      entityId: clientId,
      before,
      after: client,
    });
    return { data: client };
  });

  app.delete("/api/v1/clients/:clientId", { preHandler: requirePermission("manage_clients") }, async (request) => {
    const clientId = getNumericParam(request, "clientId");
    const before = await fetchClientById(clientId);
    const deleted = await deleteClientService(clientId);
    await writeAuditLog({
      request,
      action: "client.delete",
      entityType: "client",
      entityId: clientId,
      before,
      after: { deleted },
    });
    return { data: { deleted } };
  });
}
