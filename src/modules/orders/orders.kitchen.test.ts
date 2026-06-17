import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeKitchenOrder } from "@backend/modules/orders/orders.service";
import type { OrderListItem } from "@backend/modules/orders/orders.types";

test("kitchen order payload hides personal and financial data", () => {
  const order: OrderListItem = {
    id: 42,
    status: "SENT_TO_KITCHEN",
    source: "SITE",
    isInternal: false,
    clientId: 7,
    clientName: "Иван Иванов",
    clientType: "CLIENT",
    employeeId: 3,
    employeeName: "Диспетчер смены",
    customerPhoneSnapshot: "+79000000000",
    deliveryAddressSnapshot: "ул. Тестовая, 1",
    customerComment: "Без лука",
    subtotalCents: 120000,
    discountPercent: 10,
    totalCents: 108000,
    createdAt: "2026-06-17T10:00:00.000Z",
    items: [{
      id: 11,
      catalogItemId: 5,
      catalogItemVariantId: 6,
      itemName: "Пицца",
      quantity: 2,
      unitPriceCents: 60000,
      totalPriceCents: 120000,
      catalogCategory: "Пицца",
      kitchenZone: "pizza",
      kitchenZones: ["pizza"],
      excludedIngredients: [{ id: 1, productId: 2, label: "Лук" }],
      packagingUsages: [],
    }],
  };

  const kitchenOrder = sanitizeKitchenOrder(order);
  const payload = kitchenOrder as Record<string, unknown>;
  const itemPayload = kitchenOrder.items[0] as Record<string, unknown>;

  assert.equal(payload.clientId, undefined);
  assert.equal(payload.clientName, undefined);
  assert.equal(payload.customerPhoneSnapshot, undefined);
  assert.equal(payload.deliveryAddressSnapshot, undefined);
  assert.equal(payload.totalCents, undefined);
  assert.equal(itemPayload.unitPriceCents, undefined);
  assert.equal(itemPayload.totalPriceCents, undefined);
  assert.equal(kitchenOrder.customerComment, "Без лука");
  assert.equal(kitchenOrder.items[0]?.itemName, "Пицца");
  assert.deepEqual(kitchenOrder.items[0]?.excludedIngredients.map((item) => item.label), ["Лук"]);
});
