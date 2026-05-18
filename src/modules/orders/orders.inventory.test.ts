import test from "node:test";
import assert from "node:assert/strict";
import { shouldConsumeOrderStock } from "@backend/modules/orders/orders.inventory";
import { ORDER_STATUSES } from "@backend/modules/orders/orders.types";

test("inventory is consumed once the kitchen marks an order ready", () => {
  for (const status of ORDER_STATUSES) {
    assert.equal(shouldConsumeOrderStock(status), status === "READY");
  }
});
