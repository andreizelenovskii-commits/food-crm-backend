import { pool } from "@backend/shared/db/pool";
import { withTransaction } from "@backend/shared/db/transaction";
import { ValidationError } from "@backend/shared/errors/app-error";
import type { WriteoffActSummary } from "@backend/modules/inventory/inventory.types";
import type { CreateWriteoffActInput } from "@backend/modules/inventory/inventory.validation";
import { mapMissingWriteoffTables } from "@backend/modules/inventory/inventory.repository.internals";
import { getWriteoffActs } from "@backend/modules/inventory/inventory.repository.writeoff-read";
import { assertStockCanDecrease } from "@backend/modules/inventory/inventory.stock-guard";

export async function createWriteoffAct(
  input: CreateWriteoffActInput,
): Promise<WriteoffActSummary> {
  try {
    const actId = await withTransaction(async (client) => {
      const responsibleResult = await client.query<{ id: number }>(
        `
          SELECT "id"
          FROM "Employee"
          WHERE "id" = $1
          LIMIT 1
        `,
        [input.responsibleEmployeeId],
      );

      if (!responsibleResult.rows[0]) {
        throw new ValidationError("Ответственный сотрудник не найден");
      }

      const productIds = input.items.map((item) => item.productId);
      const productsResult = await client.query<{
        id: number;
        name: string;
        category: string | null;
        unit: string;
        priceCents: number;
      }>(
        `
          SELECT "id", "name", "category", "unit", "priceCents"
          FROM "Product"
          WHERE "id" = ANY($1::int[])
        `,
        [productIds],
      );

      if (productsResult.rows.length !== productIds.length) {
        throw new ValidationError("Часть товаров для списания уже недоступна. Обнови страницу и попробуй снова.");
      }

      const productsById = new Map(productsResult.rows.map((row) => [row.id, row]));

      const actResult = await client.query<{ id: number }>(
        `
          INSERT INTO "WriteoffAct" ("responsibleEmployeeId", "reason", "notes")
          VALUES ($1, $2, $3)
          RETURNING "id"
        `,
        [input.responsibleEmployeeId, input.reason, input.notes],
      );

      const createdActId = actResult.rows[0]?.id;

      if (!createdActId) {
        throw new ValidationError("Не удалось создать акт списания");
      }

      for (const item of input.items) {
        const product = productsById.get(item.productId);

        if (!product) {
          throw new ValidationError("Товар для списания не найден");
        }

        await client.query(
          `
            INSERT INTO "WriteoffActItem" (
              "writeoffActId",
              "productId",
              "productName",
              "productCategory",
              "productUnit",
              "quantity",
              "priceCents"
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            createdActId,
            product.id,
            product.name,
            product.category,
            product.unit,
            item.quantity,
            product.priceCents,
          ],
        );
      }

      return createdActId;
    });

    const acts = await getWriteoffActs();
    const created = acts.find((act) => act.id === actId);

    if (!created) {
      throw new ValidationError("Акт списания создан, но не удалось прочитать его данные.");
    }

    return created;
  } catch (error) {
    mapMissingWriteoffTables(error);
  }
}

export async function completeWriteoffAct(actId: number) {
  try {
    if (!Number.isInteger(actId) || actId <= 0) {
      throw new ValidationError("Акт списания не найден");
    }

    const actResult = await pool.query<{ id: number; completedAt: Date | null }>(
      `
        SELECT "id", "completedAt"
        FROM "WriteoffAct"
        WHERE "id" = $1
        LIMIT 1
      `,
      [actId],
    );

    const act = actResult.rows[0];

    if (!act) {
      throw new ValidationError("Акт списания не найден");
    }

    if (act.completedAt) {
      throw new ValidationError("Этот акт списания уже завершён");
    }

    const itemsResult = await pool.query<{
      id: number;
      productId: number;
      quantity: number;
    }>(
      `
        SELECT "id", "productId", "quantity"
        FROM "WriteoffActItem"
        WHERE "writeoffActId" = $1
        ORDER BY "id" ASC
      `,
      [actId],
    );

    if (!itemsResult.rowCount) {
      throw new ValidationError("В акте списания нет ни одной строки");
    }

    await withTransaction(async (client) => {
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
          throw new ValidationError("Часть товаров из акта списания уже недоступна");
        }

        assertStockCanDecrease(currentStockQuantity, item.quantity, {
          productName: product.name,
          productUnit: product.unit,
        });

        const stockQuantityAfter = currentStockQuantity - item.quantity;

        await client.query(
          `
            UPDATE "Product"
            SET "stockQuantity" = $2
            WHERE "id" = $1
          `,
          [item.productId, stockQuantityAfter],
        );

        await client.query(
          `
            UPDATE "WriteoffActItem"
            SET "stockQuantityBefore" = $2,
                "stockQuantityAfter" = $3
            WHERE "id" = $1
          `,
          [item.id, currentStockQuantity, stockQuantityAfter],
        );
      }

      await client.query(
        `
          UPDATE "WriteoffAct"
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

export async function deleteWriteoffAct(actId: number) {
  try {
    if (!Number.isInteger(actId) || actId <= 0) {
      throw new ValidationError("Акт списания не найден");
    }

    const actResult = await pool.query<{ id: number; completedAt: Date | null }>(
      `
        SELECT "id", "completedAt"
        FROM "WriteoffAct"
        WHERE "id" = $1
        LIMIT 1
      `,
      [actId],
    );

    const act = actResult.rows[0];

    if (!act) {
      throw new ValidationError("Акт списания не найден");
    }

    const itemsResult = await pool.query<{
      productId: number;
      quantity: number;
    }>(
      `
        SELECT "productId", "quantity"
        FROM "WriteoffActItem"
        WHERE "writeoffActId" = $1
        ORDER BY "id" ASC
      `,
      [actId],
    );

    await withTransaction(async (client) => {
      if (act.completedAt) {
        for (const item of itemsResult.rows) {
          const productResult = await client.query<{ stockQuantity: number }>(
            `
              SELECT "stockQuantity"
              FROM "Product"
              WHERE "id" = $1
              LIMIT 1
            `,
            [item.productId],
          );

          const currentStockQuantity = productResult.rows[0]?.stockQuantity;

          if (typeof currentStockQuantity !== "number") {
            throw new ValidationError("Часть товаров из акта списания уже недоступна, остатки восстановить нельзя");
          }

          await client.query(
            `
              UPDATE "Product"
              SET "stockQuantity" = $2
              WHERE "id" = $1
            `,
            [item.productId, currentStockQuantity + item.quantity],
          );
        }
      }

      await client.query(
        `
          DELETE FROM "WriteoffAct"
          WHERE "id" = $1
        `,
        [actId],
      );
    });
  } catch (error) {
    mapMissingWriteoffTables(error);
  }
}
