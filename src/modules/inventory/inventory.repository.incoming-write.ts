import { pool } from "@backend/shared/db/pool";
import { withTransaction } from "@backend/shared/db/transaction";
import { ValidationError } from "@backend/shared/errors/app-error";
import type { IncomingActSummary } from "@backend/modules/inventory/inventory.types";
import type { CreateIncomingActInput } from "@backend/modules/inventory/inventory.validation";
import { mapMissingWriteoffTables } from "@backend/modules/inventory/inventory.repository.internals";
import { getIncomingActs, getIncomingActById } from "@backend/modules/inventory/inventory.repository.incoming-read";

export async function createIncomingAct(
  input: CreateIncomingActInput,
): Promise<IncomingActSummary> {
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
      }>(
        `
          SELECT "id", "name", "category", "unit"
          FROM "Product"
          WHERE "id" = ANY($1::int[])
        `,
        [productIds],
      );

      if (productsResult.rows.length !== productIds.length) {
        throw new ValidationError("Часть товаров для поступления уже недоступна. Обнови страницу и попробуй снова.");
      }

      const productsById = new Map(productsResult.rows.map((row) => [row.id, row]));

      const actResult = await client.query<{ id: number }>(
        `
          INSERT INTO "IncomingAct" ("responsibleEmployeeId", "supplierName", "notes")
          VALUES ($1, $2, $3)
          RETURNING "id"
        `,
        [input.responsibleEmployeeId, input.supplierName, input.notes],
      );

      const createdActId = actResult.rows[0]?.id;

      if (!createdActId) {
        throw new ValidationError("Не удалось создать акт поступления");
      }

      for (const item of input.items) {
        const product = productsById.get(item.productId);

        if (!product) {
          throw new ValidationError("Товар для поступления не найден");
        }

        await client.query(
          `
            INSERT INTO "IncomingActItem" (
              "incomingActId",
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
            item.priceCents,
          ],
        );
      }

      return createdActId;
    });

    const acts = await getIncomingActs();
    const created = acts.find((act) => act.id === actId);

    if (!created) {
      throw new ValidationError("Акт поступления создан, но не удалось прочитать его данные.");
    }

    return created;
  } catch (error) {
    mapMissingWriteoffTables(error);
  }
}

export async function updateIncomingAct(
  actId: number,
  input: CreateIncomingActInput,
): Promise<IncomingActSummary> {
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
      throw new ValidationError("Завершённый акт поступления редактировать нельзя");
    }

    await withTransaction(async (client) => {
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
      }>(
        `
          SELECT "id", "name", "category", "unit"
          FROM "Product"
          WHERE "id" = ANY($1::int[])
        `,
        [productIds],
      );

      if (productsResult.rows.length !== productIds.length) {
        throw new ValidationError(
          "Часть товаров для поступления уже недоступна. Обнови страницу и попробуй снова.",
        );
      }

      const productsById = new Map(productsResult.rows.map((row) => [row.id, row]));

      await client.query(
        `
          UPDATE "IncomingAct"
          SET "responsibleEmployeeId" = $2,
              "supplierName" = $3,
              "notes" = $4
          WHERE "id" = $1
        `,
        [actId, input.responsibleEmployeeId, input.supplierName, input.notes],
      );

      await client.query(
        `
          DELETE FROM "IncomingActItem"
          WHERE "incomingActId" = $1
        `,
        [actId],
      );

      for (const item of input.items) {
        const product = productsById.get(item.productId);

        if (!product) {
          throw new ValidationError("Товар для поступления не найден");
        }

        await client.query(
          `
            INSERT INTO "IncomingActItem" (
              "incomingActId",
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
            actId,
            product.id,
            product.name,
            product.category,
            product.unit,
            item.quantity,
            item.priceCents,
          ],
        );
      }
    });

    const updated = await getIncomingActById(actId);

    if (!updated) {
      throw new ValidationError("Акт поступления обновлён, но не удалось прочитать его данные.");
    }

    return updated;
  } catch (error) {
    mapMissingWriteoffTables(error);
  }
}
