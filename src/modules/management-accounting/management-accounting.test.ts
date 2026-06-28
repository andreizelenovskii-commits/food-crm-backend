import test from "node:test";
import assert from "node:assert/strict";
import {
  parseManagementAccountingDayActionInput,
  parseManagementAccountingManualEntryInput,
  parseManagementAccountingQuery,
} from "@backend/modules/management-accounting/management-accounting.validation";

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

test("management accounting manual entry input normalizes amount", () => {
  assert.deepEqual(parseManagementAccountingManualEntryInput({
    date: "2026-06-28",
    type: "EXPENSE",
    category: "Бензин",
    amount: "1250,50",
    comment: "Курьеры",
  }), {
    date: "2026-06-28",
    type: "EXPENSE",
    category: "Бензин",
    amountCents: 125050,
    comment: "Курьеры",
  });
});

test("management accounting day action input accepts daily date", () => {
  assert.deepEqual(parseManagementAccountingDayActionInput({ date: "2026-06-28" }), {
    date: "2026-06-28",
  });
});

test("management accounting manual entry input rejects empty category", () => {
  assert.throws(
    () => parseManagementAccountingManualEntryInput({
      date: "2026-06-28",
      type: "EXPENSE",
      category: "",
      amount: "100",
    }),
    /Заполните статью/,
  );
});
