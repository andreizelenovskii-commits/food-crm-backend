import test from "node:test";
import assert from "node:assert/strict";
import { parseManagementAccountingQuery } from "@backend/modules/management-accounting/management-accounting.validation";

test("management accounting query accepts daily date", () => {
  assert.deepEqual(parseManagementAccountingQuery({ date: "2026-06-28" }), {
    date: "2026-06-28",
  });
});

test("management accounting query rejects partial dates", () => {
  assert.throws(
    () => parseManagementAccountingQuery({ date: "2026-06" }),
    /Некорректная дата управленческого учета/,
  );
});
