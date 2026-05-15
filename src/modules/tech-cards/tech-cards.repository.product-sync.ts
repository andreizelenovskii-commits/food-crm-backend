import type { PoolClient } from "pg";
import { ValidationError } from "@backend/shared/errors/app-error";
import { INGREDIENT_TECH_CARD_CATEGORY } from "@backend/modules/tech-cards/tech-cards.types";
import type { TechCardInput } from "@backend/modules/tech-cards/tech-cards.validation";

const INGREDIENT_PRODUCT_CATEGORY = "Ингредиенты";

export async function syncIngredientTechCardProduct(
  client: PoolClient,
  input: TechCardInput,
  previousName?: string,
) {
  if (input.category !== INGREDIENT_TECH_CARD_CATEGORY) {
    return;
  }

  const productByName = await client.query<{ id: number }>(
    `
      SELECT "id"
      FROM "Product"
      WHERE LOWER("name") = LOWER($1)
      LIMIT 1
    `,
    [input.name],
  );
  const productByPreviousName =
    productByName.rows[0] || !previousName || previousName === input.name
      ? null
      : await client.query<{ id: number }>(
          `
            SELECT "id"
            FROM "Product"
            WHERE LOWER("name") = LOWER($1)
            LIMIT 1
          `,
          [previousName],
        );
  const productId = productByName.rows[0]?.id ?? productByPreviousName?.rows[0]?.id ?? null;

  if (productId) {
    await client.query(
      `
        UPDATE "Product"
        SET
          "name" = $2,
          "category" = $3,
          "unit" = $4,
          "description" = $5
        WHERE "id" = $1
      `,
      [productId, input.name, INGREDIENT_PRODUCT_CATEGORY, input.outputUnit, input.description],
    );
    return;
  }

  const insertedProduct = await client.query<{ id: number }>(
    `
      INSERT INTO "Product" ("name", "category", "unit", "stockQuantity", "priceCents", "description")
      VALUES ($1, $2, $3, 0, 0, $4)
      RETURNING "id"
    `,
    [input.name, INGREDIENT_PRODUCT_CATEGORY, input.outputUnit, input.description],
  );
  const createdProductId = insertedProduct.rows[0]?.id;

  if (!createdProductId) {
    throw new ValidationError("Техкарта создана, но складской ингредиент не удалось сохранить.");
  }

  await client.query(
    `
      UPDATE "Product"
      SET "sku" = CONCAT('PRD-', LPAD($2::text, 5, '0'))
      WHERE "id" = $1
    `,
    [createdProductId, createdProductId],
  );
}
