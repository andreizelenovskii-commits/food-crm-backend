import test from "node:test";
import assert from "node:assert/strict";
import type { PoolClient } from "pg";
import { consumeOrderStockForStatus, shouldConsumeOrderStock } from "@backend/modules/orders/orders.inventory";
import { ORDER_STATUSES } from "@backend/modules/orders/orders.types";

test("inventory is consumed once the kitchen marks an order ready", () => {
  for (const status of ORDER_STATUSES) {
    assert.equal(shouldConsumeOrderStock(status), status === "READY");
  }
});

test("product -> tech card -> ingredients -> order consumes stock through the tech card", async () => {
  const executedQueries: Array<{ text: string; values?: unknown[] }> = [];
  const client = {
    async query(text: string, values?: unknown[]) {
      executedQueries.push({ text, values });

      if (text.includes('FROM "OrderInventoryMovement"')) {
        return { rowCount: 0, rows: [] };
      }

      if (text.includes('FROM "OrderItem" oi') && text.includes("CASE")) {
        return { rowCount: 0, rows: [] };
      }

      if (text.includes("WITH RECURSIVE card_tree")) {
        return {
          rowCount: 1,
          rows: [
            {
              productId: 10,
              productName: "Тесто",
              productUnit: "кг",
              requiredQuantity: "0.5",
            },
          ],
        };
      }

      if (text.includes('FROM "Product"') && text.includes("FOR UPDATE")) {
        return { rowCount: 1, rows: [{ id: 10, stockQuantity: 2 }] };
      }

      if (text.includes('UPDATE "Product"')) {
        return { rowCount: 1, rows: [] };
      }

      if (text.includes('INSERT INTO "OrderInventoryMovement"')) {
        return { rowCount: 1, rows: [] };
      }

      throw new Error(`Unexpected query in inventory smoke test: ${text}`);
    },
  } as unknown as PoolClient;

  await consumeOrderStockForStatus(client, 42, "READY", 7);

  const stockUpdate = executedQueries.find((query) => query.text.includes('UPDATE "Product"'));
  assert.deepEqual(stockUpdate?.values, [10, 1.5]);

  const movementInsert = executedQueries.find((query) =>
    query.text.includes('INSERT INTO "OrderInventoryMovement"'),
  );
  assert.deepEqual(movementInsert?.values, [
    42,
    10,
    "Тесто",
    "кг",
    0.5,
    "READY",
    "Заказ #42: приготовление",
    7,
    2,
    1.5,
  ]);
});
