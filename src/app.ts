import fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { backendEnv } from "@backend/config/env";
import { registerErrorHandler } from "@backend/lib/error-handler";
import { registerAuthRoutes } from "@backend/modules/auth/auth.routes";
import { registerPublicAuthRoutes } from "@backend/modules/public-auth/public-auth.routes";
import { registerDashboardRoutes } from "@backend/modules/dashboard/dashboard.routes";
import { registerClientsRoutes } from "@backend/modules/clients/clients.routes";
import { registerEmployeesRoutes } from "@backend/modules/employees/employees.routes";
import { registerOrdersRoutes } from "@backend/modules/orders/orders.routes";
import { registerInventoryRoutes } from "@backend/modules/inventory/inventory.routes";
import { registerCatalogRoutes } from "@backend/modules/catalog/catalog.routes";
import { registerTechCardRoutes } from "@backend/modules/tech-cards/tech-cards.routes";
import { registerLoyaltyRoutes } from "@backend/modules/loyalty/loyalty.routes";
import { registerAccessRoutes } from "@backend/modules/access/access.routes";

declare module "fastify" {
  interface FastifyInstance {
    sessionCookieName: string;
  }
}

export async function createApp() {
  const app = fastify({
    logger: true,
  });

  app.decorate("sessionCookieName", backendEnv.sessionCookieName);

  await app.register(cookie);
  await app.register(cors, {
    origin: backendEnv.corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["content-type"],
  });

  registerErrorHandler(app);

  app.get("/api/v1/health", async () => ({
    data: {
      service: "food-crm-backend",
      status: "ok",
      environment: process.env.NODE_ENV ?? "development",
      timestamp: new Date().toISOString(),
    },
  }));

  await registerAuthRoutes(app);
  await registerPublicAuthRoutes(app);
  await registerAccessRoutes(app);
  await registerDashboardRoutes(app);
  await registerLoyaltyRoutes(app);
  await registerClientsRoutes(app);
  await registerEmployeesRoutes(app);
  await registerOrdersRoutes(app);
  await registerCatalogRoutes(app);
  await registerTechCardRoutes(app);
  await registerInventoryRoutes(app);

  return app;
}
