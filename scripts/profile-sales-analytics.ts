import { addDays, buildSalesAnalyticsRange } from "@backend/modules/sales-analytics/sales-analytics.periods";
import {
  salesAnalyticsQueryDefinitions,
  type SalesAnalyticsRangeInput,
} from "@backend/modules/sales-analytics/sales-analytics.repository";
import type { SalesAnalyticsPeriod } from "@backend/modules/sales-analytics/sales-analytics.types";
import { pool } from "@backend/shared/db/pool";

type ExplainNode = {
  "Node Type"?: string;
  "Actual Rows"?: number;
  "Rows Removed by Filter"?: number;
  "Shared Hit Blocks"?: number;
  "Shared Read Blocks"?: number;
  "Temp Read Blocks"?: number;
  "Temp Written Blocks"?: number;
  "Sort Method"?: string;
  Plans?: ExplainNode[];
};

type ExplainPlan = {
  Plan?: ExplainNode;
  "Planning Time"?: number;
  "Execution Time"?: number;
};

const SUPPORTED_PERIODS = new Set(["day", "week", "month", "year"]);

function parseArgs() {
  const args = new Map<string, string>();

  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([^=]+)=(.+)$/);
    if (match) {
      args.set(match[1], match[2]);
    }
  }

  const period = args.get("period") ?? "month";
  const date = args.get("date");
  const explain = args.get("explain") !== "false";

  if (!SUPPORTED_PERIODS.has(period)) {
    throw new Error(`Unsupported period: ${period}`);
  }

  return { period: period as SalesAnalyticsPeriod, date, explain };
}

function walkPlan(node: ExplainNode | undefined, visitor: (node: ExplainNode) => void) {
  if (!node) {
    return;
  }

  visitor(node);

  for (const child of node.Plans ?? []) {
    walkPlan(child, visitor);
  }
}

function summarizePlan(plan: ExplainPlan) {
  const scanTypes = new Set<string>();
  const sortMethods = new Set<string>();
  let actualRows = 0;
  let rowsRemoved = 0;
  let sharedHitBlocks = 0;
  let sharedReadBlocks = 0;
  let tempReadBlocks = 0;
  let tempWrittenBlocks = 0;

  walkPlan(plan.Plan, (node) => {
    const nodeType = node["Node Type"];
    if (nodeType?.includes("Scan")) {
      scanTypes.add(nodeType);
    }
    if (node["Sort Method"]) {
      sortMethods.add(node["Sort Method"]);
    }
    actualRows += Math.round(node["Actual Rows"] ?? 0);
    rowsRemoved += Math.round(node["Rows Removed by Filter"] ?? 0);
    sharedHitBlocks += Math.round(node["Shared Hit Blocks"] ?? 0);
    sharedReadBlocks += Math.round(node["Shared Read Blocks"] ?? 0);
    tempReadBlocks += Math.round(node["Temp Read Blocks"] ?? 0);
    tempWrittenBlocks += Math.round(node["Temp Written Blocks"] ?? 0);
  });

  return {
    planningMs: Number((plan["Planning Time"] ?? 0).toFixed(2)),
    executionMs: Number((plan["Execution Time"] ?? 0).toFixed(2)),
    rootNode: plan.Plan?.["Node Type"] ?? "unknown",
    scanTypes: Array.from(scanTypes).sort(),
    actualRows,
    rowsRemoved,
    buffers: {
      sharedHitBlocks,
      sharedReadBlocks,
    },
    sortMethods: Array.from(sortMethods).sort(),
    tempDisk: {
      tempReadBlocks,
      tempWrittenBlocks,
    },
  };
}

async function main() {
  const { period, date, explain } = parseArgs();
  const range = buildSalesAnalyticsRange(period, date);
  const input: SalesAnalyticsRangeInput = {
    start: range.start,
    end: range.end,
    lookbackStart: addDays(new Date(range.end), -60).toISOString(),
  };
  const client = await pool.connect();

  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '15000ms'");
    await client.query("SET LOCAL lock_timeout = '3000ms'");

    console.log(`# Sales analytics SQL profile`);
    console.log(`period=${range.period}`);
    console.log(`date=${range.selectedDate}`);
    console.log(`range_start=${range.start}`);
    console.log(`range_end=${range.end}`);

    for (const definition of Object.values(salesAnalyticsQueryDefinitions)) {
      if (!explain) {
        console.log(JSON.stringify({ query: definition.name, skipped: true }));
        continue;
      }

      const result = await client.query<{ "QUERY PLAN": ExplainPlan[] }>(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${definition.sql}`,
        definition.values(input),
      );
      const plan = result.rows[0]?.["QUERY PLAN"]?.[0];

      if (!plan) {
        console.log(JSON.stringify({ query: definition.name, error: "missing_plan" }));
        continue;
      }

      console.log(JSON.stringify({
        query: definition.name,
        ...summarizePlan(plan),
        assessment: (plan["Execution Time"] ?? 0) > 1000 ? "critical" : (plan["Execution Time"] ?? 0) > 300 ? "watch" : "ok",
      }));
    }
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown profile error";
  console.error(`Profile failed: ${message.replace(/postgres(ql)?:\/\/[^ ]+/gi, "postgresql://***")}`);
  process.exit(1);
});
