import type { FastifyInstance } from "fastify";
import { authenticateRequest } from "@backend/modules/auth/auth-context";
import { ACCESS_PERMISSIONS, ROLE_MODELS } from "@backend/modules/access/access-control";

export async function registerAccessRoutes(app: FastifyInstance) {
  app.get(
    "/api/v1/access-model",
    {
      preHandler: authenticateRequest,
    },
    async () => ({
      data: {
        permissions: ACCESS_PERMISSIONS,
        roles: Object.values(ROLE_MODELS),
      },
    }),
  );
}
