import { pool } from "@backend/shared/db/pool";
import { withTransaction } from "@backend/shared/db/transaction";
import { ValidationError } from "@backend/shared/errors/app-error";
import {
  calculateWeightedAveragePriceCents,
  mapMissingWriteoffTables,
} from "@backend/modules/inventory/inventory.repository.internals";
import {
  assertNonNegativeStock,
  assertStockCanDecrease,
} from "@backend/modules/inventory/inventory.stock-guard";

export async function completeIncomingAct(actId: number) {
  try {
    if (!Number.isInteger(actId) || actId <= 0) {
      throw new ValidationError("Акт поступления не найден");
    }

    const actResult = await pool.query<{ id: number; completedAt: Date | null }>(
      `
        SELECT "id", "completedAt"
        FROM "IncomingAct"
        WHERE "id" = $1
        LIMIT 1
      `,
      [actId],
    );

    const act = actResult.rows[0];

    if (!act) {
      throw new ValidationError("Акт поступления не найден");
    }

    if (act.completedAt) {
      throw new ValidationError("Этот акт поступления уже завершён");
    }

    const itemsResult = await pool.query<{
      id: number;
      productId: number;
      quantity: number;
      priceCents: number;
    }>(
      `
        SELECT "id", "productId", "quantity", "priceCents"
        FROM "IncomingActItem"
        WHERE "incomingActId" = $1
        ORDER BY "id" ASC
      `,
      [actId],
    );

    if (!itemsResult.rowCount) {
      throw new ValidationError("В акте поступления нет ни одной строки");
    }

    await withTransaction(async (client) => {
      for (const item of itemsResult.rows) {
        const productResult = await client.query<{
          name: string;
          unit: string;
          stockQuantity: number;
          priceCents: number;
        }>(
          `
            SELECT "name", "unit", "stockQuantity", "priceCents"
            FROM "Product"
            WHERE "id" = $1
            FOR UPDATE
            LIMIT 1
          `,
          [item.productId],
        );

        const product = productResult.rows[0];
        const currentStockQuantity = product?.stockQuantity;
        const currentPriceCents = product?.priceCents;

        if (typeof currentStockQuantity !== "number" || typeof currentPriceCents !== "number") {
          throw new ValidationError("Часть товаров из акта поступления уже недоступна");
        }

        const stockQuantityAfter = currentStockQuantity + item.quantity;
        assertNonNegativeStock(stockQuantityAfter, {
          productName: product.name,
          productUnit: product.unit,
          availableQuantity: currentStockQuantity,
          requiredQuantity: Math.max(0, -currentStockQuantity),
        });

        const nextPriceCents = calculateWeightedAveragePriceCents(
          currentStockQuantity,
          currentPriceCents,
          item.quantity,
          item.priceCents,
        );

        await client.query(
          `
            UPDATE "Product"
            SET "stockQuantity" = $2,
                "priceCents" = $3
            WHERE "id" = $1
          `,
          [item.productId, stockQuantityAfter, nextPriceCents],
        );

        await client.query(
          `
            UPDATE "IncomingActItem"
            SET "stockQuantityBefore" = $2,
                "stockQuantityAfter" = $3
            WHERE "id" = $1
          `,
          [item.id, currentStockQuantity, stockQuantityAfter],
        );
      }

      await client.query(
        `
          UPDATE "IncomingAct"
          SET "completedAt" = CURRENT_TIMESTAMP
          WHERE "id" = $1
        `,
        [actId],
      );
    });
  } catch (error) {
    mapMissingWriteoffTables(error);
  }
}

export async function deleteIncomingAct(actId: number) {
  try {
    if (!Number.isInteger(actId) || actId <= 0) {
      throw new ValidationError("Акт поступления не найден");
    }

    const actResult = await pool.query<{ id: number; completedAt: Date | null }>(
      `
        SELECT "id", "completedAt"
        FROM "IncomingAct"
        WHERE "id" = $1
        LIMIT 1
      `,
      [actId],
    );

    const act = actResult.rows[0];

    if (!act) {
      throw new ValidationError("Акт поступления не найден");
    }

    const itemsResult = await pool.query<{
      productId: number;
      quantity: number;
    }>(
      `
        SELECT "productId", "quantity"
        FROM "IncomingActItem"
        WHERE "incomingActId" = $1
        ORDER BY "id" ASC
      `,
      [actId],
    );

    await withTransaction(async (client) => {
      if (act.completedAt) {
        for (const item of itemsResult.rows) {
          const productResult = await client.query<{
            name: string;
            unit: string;
            stockQuantity: number;
          }>(
            `
              SELECT "name", "unit", "stockQuantity"
              FROM "Product"
              WHERE "id" = $1
              FOR UPDATE
              LIMIT 1
            `,
            [item.productId],
          );

          const product = productResult.rows[0];
          const currentStockQuantity = product?.stockQuantity;

          if (typeof currentStockQuantity !== "number") {
            throw new ValidationError(
              "Часть товаров из акта поступления уже недоступна, остатки скорректировать нельзя",
            );
          }

          assertStockCanDecrease(currentStockQuantity, item.quantity, {
            productName: product.name,
            productUnit: product.unit,
          });

          await client.query(
            `
              UPDATE "Product"
              SET "stockQuantity" = $2
              WHERE "id" = $1
            `,
            [item.productId, currentStockQuantity - item.quantity],
          );
        }
      }

      await client.query(
        `
          DELETE FROM "IncomingAct"
          WHERE "id" = $1
        `,
        [actId],
      );
    });
  } catch (error) {
    mapMissingWriteoffTables(error);
  }
}
