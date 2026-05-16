import test from "node:test";
import assert from "node:assert/strict";
import { calculateOrderPricing } from "@backend/modules/orders/orders.pricing";

test("calculateOrderPricing applies discount and delivery fee", () => {
  assert.deepEqual(
    calculateOrderPricing({
      itemsTotalCents: 50000,
      deliveryFeeCents: 17000,
      discountPercent: 10,
      isInternal: false,
    }),
    {
      subtotalCents: 50000,
      deliveryFeeCents: 17000,
      discountCents: 5000,
      totalCents: 62000,
    },
  );
});

test("calculateOrderPricing ignores delivery and discount for internal orders", () => {
  assert.deepEqual(
    calculateOrderPricing({
      itemsTotalCents: 50000,
      deliveryFeeCents: 17000,
      discountPercent: 10,
      isInternal: true,
    }),
    {
      subtotalCents: 50000,
      deliveryFeeCents: 0,
      discountCents: 0,
      totalCents: 50000,
    },
  );
});

test("calculateOrderPricing clamps invalid discount input", () => {
  assert.equal(
    calculateOrderPricing({
      itemsTotalCents: 10000,
      deliveryFeeCents: 0,
      discountPercent: 150,
      isInternal: false,
    }).totalCents,
    0,
  );
});
