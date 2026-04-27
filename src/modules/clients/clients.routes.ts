import type { FastifyInstance } from "fastify";
import {
  addClient,
  deleteClientService,
  fetchClientById,
  fetchClients,
  updateClientService,
} from "@backend/modules/clients/clients.service";
import { parseCreateClientInput, parseUpdateClientInput } from "@backend/modules/clients/clients.validation";
import { requirePermission } from "@backend/modules/auth/auth-context";
import { getNumericParam, getRequestBody, toFormData } from "@backend/lib/request";

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
  "notes",
];

export async function registerClientsRoutes(app: FastifyInstance) {
  app.get("/api/v1/clients", { preHandler: requirePermission("view_clients") }, async () => ({
    data: await fetchClients(),
  }));

  app.post("/api/v1/clients", { preHandler: requirePermission("manage_clients") }, async (request) => {
    const input = parseCreateClientInput(toFormData(getRequestBody(request), CLIENT_FIELDS));
    return { data: await addClient(input) };
  });

  app.get("/api/v1/clients/:clientId", { preHandler: requirePermission("view_clients") }, async (request) => ({
    data: await fetchClientById(getNumericParam(request, "clientId")),
  }));

  app.patch("/api/v1/clients/:clientId", { preHandler: requirePermission("manage_clients") }, async (request) => {
    const input = parseUpdateClientInput(toFormData(getRequestBody(request), CLIENT_FIELDS));
    return { data: await updateClientService(getNumericParam(request, "clientId"), input) };
  });

  app.delete("/api/v1/clients/:clientId", { preHandler: requirePermission("manage_clients") }, async (request) => ({
    data: { deleted: await deleteClientService(getNumericParam(request, "clientId")) },
  }));
}
