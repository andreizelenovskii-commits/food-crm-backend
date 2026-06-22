import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVE_ORDER_STATUSES,
  canAdvanceOrder,
  canCancelOrder,
  canCreateOrders,
  canViewKitchenQueue,
  getOrderStageOwner,
  getNextOrderStatus,
  isOrderClosed,
} from "@backend/modules/orders/orders.workflow";

test("order workflow exposes only the allowed forward path", () => {
  assert.equal(getNextOrderStatus("NEW"), "SENT_TO_KITCHEN");
  assert.equal(getNextOrderStatus("SENT_TO_KITCHEN"), "READY");
  assert.equal(getNextOrderStatus("READY"), "PACKED");
  assert.equal(getNextOrderStatus("PACKED"), "DELIVERED_PAID");
  assert.equal(getNextOrderStatus("DELIVERED_PAID"), null);
  assert.equal(getNextOrderStatus("CANCELLED"), null);
});

test("order workflow documents stage owners", () => {
  assert.equal(getOrderStageOwner("NEW"), "Диспетчер");
  assert.equal(getOrderStageOwner("SENT_TO_KITCHEN"), "Повар");
  assert.equal(getOrderStageOwner("READY"), "Диспетчер");
  assert.equal(getOrderStageOwner("PACKED"), "Курьер");
  assert.equal(getOrderStageOwner("DELIVERED_PAID"), null);
  assert.equal(getOrderStageOwner("CANCELLED"), null);
});

test("role ownership gates order status transitions", () => {
  assert.equal(canAdvanceOrder("NEW", "Диспетчер"), true);
  assert.equal(canAdvanceOrder("NEW", "Повар"), false);
  assert.equal(canAdvanceOrder("SENT_TO_KITCHEN", "Повар"), true);
  assert.equal(canAdvanceOrder("SENT_TO_KITCHEN", "Шеф повар"), true);
  assert.equal(canAdvanceOrder("SENT_TO_KITCHEN", "Диспетчер"), false);
  assert.equal(canAdvanceOrder("READY", "Диспетчер"), true);
  assert.equal(canAdvanceOrder("READY", "Курьер"), false);
  assert.equal(canAdvanceOrder("PACKED", "Курьер"), true);
  assert.equal(canAdvanceOrder("PACKED", "Старший курьер"), true);
  assert.equal(canAdvanceOrder("PACKED", "Повар"), false);
});

test("managers can advance active orders but nobody advances closed orders", () => {
  assert.equal(canAdvanceOrder("READY", "Администратор"), true);
  assert.equal(canAdvanceOrder("READY", "Управляющий"), true);
  assert.equal(canAdvanceOrder("CANCELLED", "Управляющий"), false);
  assert.equal(canAdvanceOrder("DELIVERED_PAID", "admin"), false);
});

test("cancel and creation permissions match business roles", () => {
  assert.equal(canCancelOrder("NEW", "Диспетчер"), true);
  assert.equal(canCancelOrder("SENT_TO_KITCHEN", "Диспетчер"), true);
  assert.equal(canCancelOrder("READY", "Диспетчер"), true);
  assert.equal(canCancelOrder("READY", "Повар"), false);
  assert.equal(canCancelOrder("PACKED", "Управляющий"), true);
  assert.equal(canCancelOrder("DELIVERED_PAID", "Управляющий"), false);
  assert.equal(canCancelOrder("CANCELLED", "admin"), false);
  assert.equal(canCreateOrders("Диспетчер"), true);
  assert.equal(canCreateOrders("Управляющий"), true);
  assert.equal(canCreateOrders("Курьер"), false);
  assert.equal(isOrderClosed("CANCELLED"), true);
  assert.equal(isOrderClosed("DELIVERED_PAID"), true);
  assert.deepEqual(ACTIVE_ORDER_STATUSES, ["NEW", "SENT_TO_KITCHEN", "READY", "PACKED"]);
});

test("kitchen queue access is limited to cooks and managers", () => {
  assert.equal(canViewKitchenQueue("Повар"), true);
  assert.equal(canViewKitchenQueue("Шеф повар"), true);
  assert.equal(canViewKitchenQueue("Администратор"), true);
  assert.equal(canViewKitchenQueue("Диспетчер"), false);
  assert.equal(canViewKitchenQueue("Курьер"), false);
});
