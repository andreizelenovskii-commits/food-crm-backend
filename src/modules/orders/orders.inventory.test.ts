import test from "node:test";
import assert from "node:assert/strict";
import { shouldConsumeOrderStock } from "@backend/modules/orders/orders.inventory";

test("inventory is consumed once the kitchen marks an order ready", () => {
  assert.equal(shouldConsumeOrderStock("READY"), true);
  assert.equal(shouldConsumeOrderStock("SENT_TO_KITCHEN"), false);
  assert.equal(shouldConsumeOrderStock("PACKED"), false);
  assert.equal(shouldConsumeOrderStock("DELIVERED_PAID"), false);
  assert.equal(shouldConsumeOrderStock("CANCELLED"), false);
});
