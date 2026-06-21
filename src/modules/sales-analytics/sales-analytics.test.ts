import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildSalesAnalyticsRange,
} from "@backend/modules/sales-analytics/sales-analytics.periods";
import { parseSalesAnalyticsQuery } from "@backend/modules/sales-analytics/sales-analytics.validation";
import { ValidationError } from "@backend/shared/errors/app-error";

test("sales analytics query accepts supported periods", () => {
  for (const period of ["day", "week", "month", "year"]) {
    assert.equal(parseSalesAnalyticsQuery({ period, date: "2026-06-18" }).period, period);
  }
});

test("sales analytics query rejects unsupported periods and dates", () => {
  assert.throws(
    () => parseSalesAnalyticsQuery({ period: "quarter", date: "2026-06-18" }),
    ValidationError,
  );
  assert.throws(
    () => parseSalesAnalyticsQuery({ period: "month", date: "18-06-2026" }),
    ValidationError,
  );
});

test("sales analytics month range uses selected period boundaries", () => {
  const range = buildSalesAnalyticsRange("month", "2026-06-18");

  assert.equal(range.period, "month");
  assert.equal(range.date, "2026-06");
  assert.equal(range.selectedDate, "2026-06-18");
  assert.equal(range.previousDate, "2026-05");
  assert.equal(range.nextDate, "2026-07");
  assert.equal(range.start, new Date(2026, 5, 1).toISOString());
  assert.equal(range.end, new Date(2026, 6, 1).toISOString());
});

test("sales analytics repository uses range-filtered SQL and does not call unbounded order loader", () => {
  const repository = readFileSync(resolve("src/modules/sales-analytics/sales-analytics.repository.ts"), "utf8");
  const service = readFileSync(resolve("src/modules/sales-analytics/sales-analytics.service.ts"), "utf8");
  const routes = readFileSync(resolve("src/modules/sales-analytics/sales-analytics.routes.ts"), "utf8");

  assert.doesNotMatch(repository, /getOrders\s*\(/);
  assert.doesNotMatch(service, /getOrders\s*\(/);
  assert.match(repository, /"createdAt"\s*>=\s*\$1::timestamptz/);
  assert.match(repository, /"createdAt"\s*<\s*\$2::timestamptz/);
  assert.match(repository, /LIMIT 8/);
  assert.match(routes, /requirePermission\("view_dashboard"\)/);
  assert.match(routes, /\/api\/v1\/analytics\/sales/);
});
