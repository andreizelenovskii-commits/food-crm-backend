import test from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "@backend/shared/errors/app-error";
import {
  assertNonNegativeStock,
  assertStockCanDecrease,
} from "@backend/modules/inventory/inventory.stock-guard";

test("incoming rollback cannot make product stock negative", () => {
  assert.throws(
    () =>
      assertStockCanDecrease(2, 3, {
        productName: "Сыр",
        productUnit: "кг",
      }),
    (error) =>
      error instanceof ValidationError &&
      error.message === 'Недостаточно "Сыр": нужно 3 кг, доступно 2 кг',
  );
});

test("writeoff completion cannot consume more than available stock", () => {
  assert.doesNotThrow(() =>
    assertStockCanDecrease(5, 5, {
      productName: "Соус",
      productUnit: "л",
    }),
  );

  assert.throws(
    () =>
      assertStockCanDecrease(4.5, 5, {
        productName: "Соус",
        productUnit: "л",
      }),
    /Недостаточно "Соус"/,
  );
});

test("order consumption rejects negative stock after recipe ingredients are applied", () => {
  assert.throws(
    () =>
      assertNonNegativeStock(-0.25, {
        productName: "Мука",
        productUnit: "кг",
        availableQuantity: 1,
        requiredQuantity: 1.25,
      }),
    /Недостаточно "Мука": нужно 1,25 кг, доступно 1 кг/,
  );
});
