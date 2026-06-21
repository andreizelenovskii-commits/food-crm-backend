import type { FastifyInstance } from "fastify";
import { requirePermission } from "@backend/modules/auth/auth-context";
import { getSalesAnalytics } from "@backend/modules/sales-analytics/sales-analytics.service";
import { parseSalesAnalyticsQuery } from "@backend/modules/sales-analytics/sales-analytics.validation";

export async function registerSalesAnalyticsRoutes(app: FastifyInstance) {
  app.get(
    "/api/v1/analytics/sales",
    { preHandler: requirePermission("view_dashboard") },
    async (request) => {
      const query = parseSalesAnalyticsQuery(request.query);

      return {
        data: await getSalesAnalytics({
          ...query,
          user: request.authUser!,
        }),
      };
    },
  );
}
