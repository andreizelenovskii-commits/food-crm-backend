import type { FastifyInstance } from "fastify";
import { requirePermission } from "@backend/modules/auth/auth-context";
import {
  ACCESS_PERMISSIONS,
  getRoleModels,
  replaceRolePermissions,
} from "@backend/modules/access/access-control";
import { ValidationError } from "@backend/shared/errors/app-error";
import { getRequestBody } from "@backend/lib/request";

export async function registerAccessRoutes(app: FastifyInstance) {
  app.get(
    "/api/v1/access-model",
    {
      preHandler: requirePermission("view_settings"),
    },
    async () => ({
      data: {
        permissions: ACCESS_PERMISSIONS,
        roles: await getRoleModels(),
      },
    }),
  );

  app.put(
    "/api/v1/access-model/:role",
    {
      preHandler: requirePermission("manage_settings"),
    },
    async (request) => {
      const role = (request.params as { role?: string }).role;
      const body = getRequestBody(request);
      const permissions = Array.isArray(body.permissions) ? body.permissions : null;

      if (!role || !permissions) {
        throw new ValidationError("Передай роль и список прав");
      }

      const result = await replaceRolePermissions(decodeURIComponent(role), permissions);

      if (!result) {
        throw new ValidationError("Неизвестная роль");
      }

      return {
        data: result,
      };
    },
  );
}
