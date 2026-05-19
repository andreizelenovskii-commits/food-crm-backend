import type { FastifyInstance } from "fastify";
import {
  addTechCard,
  deleteTechCardById,
  fetchTechCardById,
  fetchTechCardOptions,
  fetchTechCardProductOptions,
  fetchTechCards,
  updateTechCardById,
} from "@backend/modules/tech-cards/tech-cards.service";
import { parseTechCardInput } from "@backend/modules/tech-cards/tech-cards.validation";
import { requirePermission } from "@backend/modules/auth/auth-context";
import { appendItems, getNumericParam, getRequestBody, toFormData } from "@backend/lib/request";

const TECH_CARD_FIELDS = [
  "name",
  "category",
  "pizzaSize",
  "autoCreatePizzaVariants",
  "outputQuantity",
  "outputUnit",
  "description",
];

function techCardFormData(body: Record<string, unknown>) {
  const formData = toFormData(body, TECH_CARD_FIELDS);
  appendItems(formData, body.ingredients, {
    productId: "ingredientProductId",
    quantity: "ingredientQuantity",
    unit: "ingredientUnit",
  });
  return formData;
}

export async function registerTechCardRoutes(app: FastifyInstance) {
  app.get("/api/v1/tech-cards", { preHandler: requirePermission("view_inventory") }, async () => ({
    data: await fetchTechCards(),
  }));

  app.get("/api/v1/tech-cards/options", { preHandler: requirePermission("view_catalog") }, async () => ({
    data: await fetchTechCardOptions(),
  }));

  app.get("/api/v1/tech-cards/product-options", { preHandler: requirePermission("view_inventory") }, async () => ({
    data: await fetchTechCardProductOptions(),
  }));

  app.post("/api/v1/tech-cards", { preHandler: requirePermission("manage_inventory") }, async (request) => {
    const input = parseTechCardInput(techCardFormData(getRequestBody(request)));
    return { data: await addTechCard(input) };
  });

  app.get("/api/v1/tech-cards/:techCardId", { preHandler: requirePermission("view_inventory") }, async (request) => ({
    data: await fetchTechCardById(getNumericParam(request, "techCardId")),
  }));

  app.patch(
    "/api/v1/tech-cards/:techCardId",
    { preHandler: requirePermission("manage_inventory") },
    async (request) => {
      const input = parseTechCardInput(techCardFormData(getRequestBody(request)));
      return { data: await updateTechCardById(getNumericParam(request, "techCardId"), input) };
    },
  );

  app.delete(
    "/api/v1/tech-cards/:techCardId",
    { preHandler: requirePermission("manage_inventory") },
    async (request) => ({
      data: { deleted: await deleteTechCardById(getNumericParam(request, "techCardId")) },
    }),
  );
}
