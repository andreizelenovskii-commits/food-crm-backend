import type { FastifyInstance } from "fastify";
import { fetchLoyaltySnapshot } from "@backend/modules/loyalty/loyalty.service";
import { requirePermission } from "@backend/modules/auth/auth-context";

export async function registerLoyaltyRoutes(app: FastifyInstance) {
  app.get("/api/v1/loyalty", { preHandler: requirePermission("view_dashboard") }, async () => ({
    data: await fetchLoyaltySnapshot(),
  }));
}
