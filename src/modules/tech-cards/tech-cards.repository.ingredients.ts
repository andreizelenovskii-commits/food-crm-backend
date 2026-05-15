import type { PoolClient } from "pg";
import type { TechCardIngredientItem } from "@backend/modules/tech-cards/tech-cards.types";
import type { TechCardInput } from "@backend/modules/tech-cards/tech-cards.validation";

type InsertedIngredientRow = {
  id: number;
  productId: number;
  productName: string;
  productUnit: string;
  quantity: number;
  unit: "кг" | "шт";
};

export async function insertTechCardIngredients(
  client: PoolClient,
  cardId: number,
  ingredients: TechCardInput["ingredients"],
): Promise<TechCardIngredientItem[]> {
  const inserted: TechCardIngredientItem[] = [];

  for (const ingredient of ingredients) {
    const result = await client.query<InsertedIngredientRow>(
      `
        INSERT INTO "TechCardIngredient" ("technologicalCardId", "productId", "quantity", "unit")
        VALUES (
          $1,
          $2,
          $3,
          (SELECT CASE WHEN "unit" = 'кг' THEN 'кг' ELSE 'шт' END FROM "Product" WHERE "id" = $2)
        )
        RETURNING
          "id",
          "productId",
          (SELECT "name" FROM "Product" WHERE "id" = $2) AS "productName",
          (SELECT "unit" FROM "Product" WHERE "id" = $2) AS "productUnit",
          "quantity",
          "unit"
      `,
      [cardId, ingredient.productId, ingredient.quantity],
    );

    inserted.push(result.rows[0]);
  }

  return inserted;
}
