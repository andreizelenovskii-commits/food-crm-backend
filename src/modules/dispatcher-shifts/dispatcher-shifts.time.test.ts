import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BUSINESS_TIME_ZONE,
  formatShiftNumber,
  getBusinessDate,
  getBusinessDayStart,
  getCloseThreshold,
  getLocalDevClockOverrideNow,
  getLocalDevClockOverridePath,
  getOpenThreshold,
  parseBusinessDateTime,
} from "@backend/modules/dispatcher-shifts/dispatcher-shifts.time";

test("business date is calculated in Asia/Sakhalin rather than device time", () => {
  assert.equal(BUSINESS_TIME_ZONE, "Asia/Sakhalin");
  assert.equal(getBusinessDate(new Date("2026-06-21T14:30:00.000Z")), "2026-06-22");
  assert.equal(getBusinessDate(new Date("2026-06-21T12:59:00.000Z")), "2026-06-21");
});

test("open and close thresholds are anchored to the business date", () => {
  const tenAmLocal = new Date("2026-06-21T23:00:00.000Z");

  assert.equal(getOpenThreshold(tenAmLocal).toISOString(), "2026-06-21T22:00:00.000Z");
  assert.equal(getCloseThreshold("2026-06-22").toISOString(), "2026-06-22T10:00:00.000Z");
  assert.equal(getBusinessDayStart(tenAmLocal).toISOString(), "2026-06-21T13:00:00.000Z");
});

test("shift number is displayed with three digits without changing stored number", () => {
  assert.equal(formatShiftNumber(1), "001");
  assert.equal(formatShiftNumber(42), "042");
  assert.equal(formatShiftNumber(1000), "1000");
});

test("local development clock override reads ignored file only in development", () => {
  const dir = mkdtempSync(join(tmpdir(), "foodlike-clock-"));
  const filePath = join(dir, ".local-dev-clock.json");

  try {
    writeFileSync(filePath, JSON.stringify({ now: "2026-06-23T22:00:00.000Z" }));

    const developmentNow = getLocalDevClockOverrideNow({
      path: filePath,
      env: { NODE_ENV: "development", LOCAL_DEV_TOOLS_ENABLED: "true" } as NodeJS.ProcessEnv,
    });
    const productionNow = getLocalDevClockOverrideNow({
      path: filePath,
      env: { NODE_ENV: "production", LOCAL_DEV_TOOLS_ENABLED: "true" } as NodeJS.ProcessEnv,
    });

    assert.equal(developmentNow?.toISOString(), "2026-06-23T22:00:00.000Z");
    assert.equal(productionNow, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("local development clock path can be isolated by env", () => {
  const dir = mkdtempSync(join(tmpdir(), "foodlike-clock-path-"));
  const overridePath = join(dir, "shift-test-clock.json");
  const previousPath = process.env.LOCAL_DEV_CLOCK_FILE;

  try {
    writeFileSync(overridePath, JSON.stringify({ now: "2026-06-23T22:00:00.000Z" }));
    process.env.LOCAL_DEV_CLOCK_FILE = overridePath;

    assert.equal(getLocalDevClockOverridePath(), overridePath);
  } finally {
    if (previousPath === undefined) {
      delete process.env.LOCAL_DEV_CLOCK_FILE;
    } else {
      process.env.LOCAL_DEV_CLOCK_FILE = previousPath;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

test("local development clock parser treats input as Asia/Sakhalin time", () => {
  const parsed = parseBusinessDateTime("2026-06-24 09:00", BUSINESS_TIME_ZONE);

  assert.equal(parsed.toISOString(), "2026-06-23T22:00:00.000Z");
  assert.throws(() => parseBusinessDateTime("bad date"), /YYYY-MM-DD HH:mm/);
});
