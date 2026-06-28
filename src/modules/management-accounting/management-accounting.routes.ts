import type { FastifyInstance } from "fastify";
import { requirePermission } from "@backend/modules/auth/auth-context";
import { getManagementAccounting } from "@backend/modules/management-accounting/management-accounting.service";
import { parseManagementAccountingQuery } from "@backend/modules/management-accounting/management-accounting.validation";

export async function registerManagementAccountingRoutes(app: FastifyInstance) {
  app.get(
    "/api/v1/analytics/management",
    { preHandler: requirePermission("view_dashboard") },
    async (request) => {
      const query = parseManagementAccountingQuery(request.query);
      const data = await getManagementAccounting({
        ...query,
        user: request.authUser!,
      });

      return { data };
    },
  );
}
