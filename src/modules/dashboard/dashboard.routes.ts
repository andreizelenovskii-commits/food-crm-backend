import type { FastifyInstance } from "fastify";
import { getDashboardMetrics, getEmployeeDashboardMetricsByEmail } from "@backend/modules/dashboard/dashboard.service";
import { requirePermission } from "@backend/modules/auth/auth-context";

export async function registerDashboardRoutes(app: FastifyInstance) {
  app.get("/api/v1/dashboard", { preHandler: requirePermission("view_dashboard") }, async (request) => {
    const user = request.authUser;
    const month = (request.query as { month?: string }).month ?? null;

    return {
      data: {
        dashboard: await getDashboardMetrics(),
        employeeDashboard: user ? await getEmployeeDashboardMetricsByEmail(user.email, month) : null,
      },
    };
  });
}
