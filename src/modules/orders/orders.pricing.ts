export type OrderPricingInput = {
  itemsTotalCents: number;
  deliveryFeeCents: number;
  discountPercent: number;
  isInternal: boolean;
};

export type OrderPricingResult = {
  subtotalCents: number;
  deliveryFeeCents: number;
  discountCents: number;
  totalCents: number;
};

export function calculateOrderPricing(input: OrderPricingInput): OrderPricingResult {
  const subtotalCents = Math.max(input.itemsTotalCents, 0);
  const deliveryFeeCents = input.isInternal ? 0 : Math.max(input.deliveryFeeCents, 0);
  const discountPercent = input.isInternal ? 0 : clampDiscountPercent(input.discountPercent);
  const discountCents = Math.round((subtotalCents * discountPercent) / 100);

  return {
    subtotalCents,
    deliveryFeeCents,
    discountCents,
    totalCents: Math.max(subtotalCents - discountCents, 0) + deliveryFeeCents,
  };
}

function clampDiscountPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 100);
}
