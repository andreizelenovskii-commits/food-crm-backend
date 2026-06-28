import type { FastifyInstance, FastifyRequest } from "fastify";
import { requirePermission } from "@backend/modules/auth/auth-context";
import { getSalesAnalytics } from "@backend/modules/sales-analytics/sales-analytics.service";
import { parseSalesAnalyticsQuery } from "@backend/modules/sales-analytics/sales-analytics.validation";

type SalesAnalyticsTimingRequest = FastifyRequest & {
  salesAnalyticsTiming?: {
    authMs?: number;
  };
};

function isPerfDebugEnabled() {
  return process.env.PERF_DEBUG === "true";
}

function formatServerTiming(name: string, durationMs: number) {
  return `${name};dur=${Math.max(0, Math.round(durationMs))}`;
}

export async function registerSalesAnalyticsRoutes(app: FastifyInstance) {
  const requireDashboard = requirePermission("view_dashboard");

  app.get(
    "/api/v1/analytics/sales",
    {
      preHandler: async (request, reply) => {
        const startedAt = performance.now();
        await requireDashboard.call(app, request, reply, () => undefined);
        (request as SalesAnalyticsTimingRequest).salesAnalyticsTiming = {
          authMs: performance.now() - startedAt,
        };
      },
    },
    async (request, reply) => {
      const totalStartedAt = performance.now();
      const query = parseSalesAnalyticsQuery(request.query);
      const serviceStartedAt = performance.now();
      const data = await getSalesAnalytics({
        ...query,
        user: request.authUser!,
      });
      const serviceMs = performance.now() - serviceStartedAt;
      const response = { data };

      if (isPerfDebugEnabled()) {
        const serializeStartedAt = performance.now();
        const serialized = JSON.stringify(response);
        const serializeMs = performance.now() - serializeStartedAt;
        const responseBytes = Buffer.byteLength(serialized);
        const totalMs = performance.now() - totalStartedAt;
        const authMs = (request as SalesAnalyticsTimingRequest).salesAnalyticsTiming?.authMs ?? 0;
        const dbMs = data.diagnostics?.dbDurationMs ?? 0;

        reply.header("Server-Timing", [
          formatServerTiming("auth", authMs),
          formatServerTiming("service", serviceMs),
          formatServerTiming("db", dbMs),
          formatServerTiming("serialize", serializeMs),
          formatServerTiming("total", totalMs),
        ].join(", "));
        reply.header("X-Response-Size", String(responseBytes));
        request.log.info({
          event: "sales_analytics.profile",
          period: query.period,
          date: query.date ?? null,
          durationMs: Math.round(totalMs),
          serviceMs: Math.round(serviceMs),
          authMs: Math.round(authMs),
          dbDurationMs: Math.round(dbMs),
          responseBytes,
          queries: data.diagnostics?.queryTimings,
        });
      }

      return response;
    },
  );
}
