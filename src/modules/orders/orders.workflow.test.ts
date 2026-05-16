import test from "node:test";
import assert from "node:assert/strict";
import {
  canAdvanceOrder,
  canCancelOrder,
  canCreateOrders,
  getNextOrderStatus,
  isOrderClosed,
} from "@backend/modules/orders/orders.workflow";

test("order workflow exposes only the allowed forward path", () => {
  assert.equal(getNextOrderStatus("SENT_TO_KITCHEN"), "READY");
  assert.equal(getNextOrderStatus("READY"), "PACKED");
  assert.equal(getNextOrderStatus("PACKED"), "DELIVERED_PAID");
  assert.equal(getNextOrderStatus("DELIVERED_PAID"), null);
  assert.equal(getNextOrderStatus("CANCELLED"), null);
});

test("role ownership gates order status transitions", () => {
  assert.equal(canAdvanceOrder("SENT_TO_KITCHEN", "Повар"), true);
  assert.equal(canAdvanceOrder("SENT_TO_KITCHEN", "Диспетчер"), false);
  assert.equal(canAdvanceOrder("READY", "Диспетчер"), true);
  assert.equal(canAdvanceOrder("READY", "Курьер"), false);
  assert.equal(canAdvanceOrder("PACKED", "Курьер"), true);
  assert.equal(canAdvanceOrder("PACKED", "Повар"), false);
});

test("managers can advance active orders but nobody advances closed orders", () => {
  assert.equal(canAdvanceOrder("READY", "Управляющий"), true);
  assert.equal(canAdvanceOrder("CANCELLED", "Управляющий"), false);
  assert.equal(canAdvanceOrder("DELIVERED_PAID", "admin"), false);
});

test("cancel and creation permissions match business roles", () => {
  assert.equal(canCancelOrder("READY", "Диспетчер"), true);
  assert.equal(canCancelOrder("READY", "Повар"), false);
  assert.equal(canCancelOrder("DELIVERED_PAID", "Управляющий"), false);
  assert.equal(canCreateOrders("Диспетчер"), true);
  assert.equal(canCreateOrders("Курьер"), false);
  assert.equal(isOrderClosed("CANCELLED"), true);
});
