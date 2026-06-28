import "dotenv/config";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import {
  BUSINESS_TIME_ZONE,
  getBusinessDate,
  getLocalDevClockOverridePath,
  parseBusinessDateTime,
} from "@backend/modules/dispatcher-shifts/dispatcher-shifts.time";

function printUsage() {
  console.log([
    "Usage:",
    "  npm run local:time:set -- \"2026-06-24 09:00\"",
    "  npm run local:time:show",
    "  npm run local:time:reset",
  ].join("\n"));
}

function formatZoned(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function readOverride(filePath: string) {
  if (!existsSync(filePath)) {
    return null;
  }

  const payload = JSON.parse(readFileSync(filePath, "utf8")) as { now?: string };

  return payload.now ? new Date(payload.now) : null;
}

function main() {
  const command = process.argv[2];
  const filePath = getLocalDevClockOverridePath();

  if (command === "set") {
    const input = process.argv.slice(3).join(" ").trim();

    if (!input) {
      printUsage();
      process.exit(1);
    }

    const now = parseBusinessDateTime(input, BUSINESS_TIME_ZONE);
    writeFileSync(filePath, `${JSON.stringify({
      now: now.toISOString(),
      timeZone: BUSINESS_TIME_ZONE,
      businessDate: getBusinessDate(now, BUSINESS_TIME_ZONE),
      note: "Local development clock override. Do not commit.",
    }, null, 2)}\n`, { mode: 0o600 });
    console.log(`Local clock override: ${formatZoned(now)} (${BUSINESS_TIME_ZONE})`);
    return;
  }

  if (command === "reset") {
    rmSync(filePath, { force: true });
    console.log("Local clock override reset.");
    return;
  }

  if (command === "show") {
    const override = readOverride(filePath);

    if (!override) {
      console.log("Local clock override inactive.");
      return;
    }

    console.log(`Local clock override: ${formatZoned(override)} (${BUSINESS_TIME_ZONE})`);
    return;
  }

  printUsage();
  process.exit(1);
}

main();
