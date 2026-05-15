import { pool } from "@backend/shared/db/pool";
import { withTransaction } from "@backend/shared/db/transaction";
import { ValidationError } from "@backend/shared/errors/app-error";
import type { InventoryAuditEntryInput } from "@backend/modules/inventory/inventory.validation";
import type { ProductRow } from "@backend/modules/inventory/inventory.repository.rows";

export type InventoryAuditResult = {
  checkedCount: number;
  updatedCount: number;
  differenceCount: number;
};

export async function applyInventoryAudit(
  entries: InventoryAuditEntryInput[],
): Promise<InventoryAuditResult> {
  if (entries.length === 0) {
    throw new ValidationError("Укажи фактический остаток хотя бы для одной позиции");
  }

  const productIds = entries.map((entry) => entry.productId);
  const currentProducts = await pool.query<Pick<ProductRow, "id" | "stockQuantity">>(
    `
      SELECT "id", "stockQuantity"
      FROM "Product"
      WHERE "id" = ANY($1::int[])
    `,
    [productIds],
  );

  if (currentProducts.rows.length !== entries.length) {
    throw new ValidationError(
      "Часть товаров для инвентаризации уже недоступна. Обнови страницу и попробуй снова.",
    );
  }

  const stockById = new Map(
    currentProducts.rows.map((row) => [row.id, row.stockQuantity]),
  );
  const changedEntries = entries.filter(
    (entry) => stockById.get(entry.productId) !== entry.actualQuantity,
  );

  await withTransaction(async (client) => {
    for (const entry of changedEntries) {
      await client.query(
        `
          UPDATE "Product"
          SET "stockQuantity" = $2
          WHERE "id" = $1
        `,
        [entry.productId, entry.actualQuantity],
      );
    }
  });

  return {
    checkedCount: entries.length,
    updatedCount: changedEntries.length,
    differenceCount: changedEntries.length,
  };
}
