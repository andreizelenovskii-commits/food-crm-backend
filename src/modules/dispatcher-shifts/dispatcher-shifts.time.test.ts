import test from "node:test";
import assert from "node:assert/strict";
import {
  BUSINESS_TIME_ZONE,
  formatShiftNumber,
  getBusinessDate,
  getBusinessDayStart,
  getCloseThreshold,
  getOpenThreshold,
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
