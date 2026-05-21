import { pool } from "@backend/shared/db/pool";
import { withTransaction } from "@backend/shared/db/transaction";
import { ValidationError } from "@backend/shared/errors/app-error";
import type {
  TechCardCategory,
  TechCardIngredientItem,
  TechCardItem,
  TechCardPizzaSize,
  TechCardProductOption,
  TechCardRollSize,
} from "@backend/modules/tech-cards/tech-cards.types";
import {
  TECH_CARD_CATEGORIES,
  TECH_CARD_PIZZA_SIZES,
  TECH_CARD_ROLL_SIZES,
} from "@backend/modules/tech-cards/tech-cards.types";
import { insertTechCardIngredients } from "@backend/modules/tech-cards/tech-cards.repository.ingredients";
import {
  buildPizzaVariantInputs,
  getPizzaVariantSizes,
  shouldCreatePizzaVariants,
} from "@backend/modules/tech-cards/tech-cards.pizza-variants";
import {
  buildRollVariantInputs,
  getRollVariantSizes,
  shouldCreateRollVariants,
} from "@backend/modules/tech-cards/tech-cards.roll-variants";
import { syncIngredientTechCardProduct } from "@backend/modules/tech-cards/tech-cards.repository.product-sync";
import type { TechCardInput } from "@backend/modules/tech-cards/tech-cards.validation";
type TechCardRow = {
  id: number;
  name: string;
  category: TechCardCategory;
  pizzaSize: string | null;
  rollSize: string | null;
  outputQuantity: number;
  outputUnit: string;
  description: string | null;
  createdAt: Date;
};

function buildDuplicateTechCardMessage(input: Pick<TechCardInput, "name" | "category" | "pizzaSize" | "rollSize">) {
  if (input.pizzaSize) {
    return `Технологическая карта "${input.name}" в категории ${input.category} с размером ${input.pizzaSize} уже существует`;
  }

  if (input.rollSize) {
    return `Технологическая карта "${input.name}" в категории ${input.category} на ${input.rollSize} уже существует`;
  }

  return `Технологическая карта "${input.name}" в категории ${input.category} уже существует`;
}

type TechCardIngredientRow = {
  id: number;
  technologicalCardId: number;
  productId: number;
  productName: string;
  productUnit: string;
  quantity: number;
  unit: "кг" | "шт";
};

function mapTechCardRow(row: TechCardRow, ingredients: TechCardIngredientItem[]): TechCardItem {
  return {
    id: row.id,
    name: row.name,
    category: TECH_CARD_CATEGORIES.includes(row.category)
      ? row.category
      : TECH_CARD_CATEGORIES[0],
    pizzaSize:
      row.pizzaSize && TECH_CARD_PIZZA_SIZES.includes(row.pizzaSize as TechCardPizzaSize)
        ? (row.pizzaSize as TechCardPizzaSize)
        : null,
    rollSize:
      row.rollSize && TECH_CARD_ROLL_SIZES.includes(row.rollSize as TechCardRollSize)
        ? (row.rollSize as TechCardRollSize)
        : null,
    outputQuantity: row.outputQuantity,
    outputUnit: row.outputUnit,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    ingredients,
  };
}

function mapTechCardIngredientRow(row: TechCardIngredientRow): TechCardIngredientItem {
  return {
    id: row.id,
    productId: row.productId,
    productName: row.productName,
    productUnit: row.productUnit,
    quantity: row.quantity,
    unit: row.unit,
  };
}

async function getIngredientsForCards(cardIds: number[]) {
  if (cardIds.length === 0) {
    return {} as Record<number, TechCardIngredientItem[]>;
  }

  const ingredientsResult = await pool.query<TechCardIngredientRow>(
    `
      SELECT
        i."id",
        i."technologicalCardId",
        i."productId",
        p."name" AS "productName",
        p."unit" AS "productUnit",
        i."quantity",
        i."unit"
      FROM "TechCardIngredient" i
      INNER JOIN "Product" p ON p."id" = i."productId"
      WHERE i."technologicalCardId" = ANY($1::int[])
      ORDER BY i."id" ASC
    `,
    [cardIds],
  );

  return ingredientsResult.rows.reduce<Record<number, TechCardIngredientItem[]>>((acc, row) => {
    const current = acc[row.technologicalCardId] ?? [];
    current.push(mapTechCardIngredientRow(row));
    acc[row.technologicalCardId] = current;
    return acc;
  }, {});
}

export async function getTechCardProductOptions(): Promise<TechCardProductOption[]> {
  const result = await pool.query<{ id: number; name: string; category: string | null; unit: string }>(
    `
      SELECT "id", "name", "category", "unit"
      FROM "Product"
      ORDER BY "category" ASC NULLS LAST, "name" ASC
    `,
  );

  return result.rows;
}

export async function getTechCards(): Promise<TechCardItem[]> {
  const cardsResult = await pool.query<TechCardRow>(
    `
      SELECT "id", "name", "category", "pizzaSize", "rollSize", "outputQuantity", "outputUnit", "description", "createdAt"
      FROM "TechnologicalCard"
      ORDER BY "createdAt" DESC, "id" DESC
    `,
  );

  if (!cardsResult.rowCount) {
    return [];
  }

  const ingredientsByCard = await getIngredientsForCards(cardsResult.rows.map((row) => row.id));

  return cardsResult.rows.map((row) => mapTechCardRow(row, ingredientsByCard[row.id] ?? []));
}

export async function getTechCardById(id: number): Promise<TechCardItem | null> {
  const cardResult = await pool.query<TechCardRow>(
    `
      SELECT "id", "name", "category", "pizzaSize", "rollSize", "outputQuantity", "outputUnit", "description", "createdAt"
      FROM "TechnologicalCard"
      WHERE "id" = $1
      LIMIT 1
    `,
    [id],
  );

  if (!cardResult.rowCount) {
    return null;
  }

  const card = cardResult.rows[0];
  const ingredientsByCard = await getIngredientsForCards([card.id]);

  return mapTechCardRow(card, ingredientsByCard[card.id] ?? []);
}

export async function getTechCardOptions(): Promise<Array<{ id: number; name: string; category: string; pizzaSize: string | null; rollSize: string | null }>> {
  const result = await pool.query<{ id: number; name: string; category: string; pizzaSize: string | null; rollSize: string | null }>(
    `
      SELECT "id", "name", "category", "pizzaSize", "rollSize"
      FROM "TechnologicalCard"
      ORDER BY "category" ASC, "name" ASC, "pizzaSize" ASC NULLS LAST, "rollSize" ASC NULLS LAST
    `,
  );

  return result.rows;
}

export async function createTechCard(input: TechCardInput): Promise<TechCardItem> {
  try {
    return await withTransaction(async (client) => {
      const existing = await client.query<{ id: number }>(
        `
          SELECT "id"
          FROM "TechnologicalCard"
          WHERE LOWER(REGEXP_REPLACE(TRIM("name"), '\s+', ' ', 'g')) = LOWER($1)
            AND "category" = $2
            AND COALESCE("pizzaSize", '') = COALESCE($3, '')
            AND COALESCE("rollSize", '') = COALESCE($4, '')
          LIMIT 1
        `,
        [input.name, input.category, input.pizzaSize, input.rollSize],
      );

      if (existing.rowCount) {
        throw new ValidationError(buildDuplicateTechCardMessage(input));
      }

      if (shouldCreatePizzaVariants(input)) {
        const existingVariants = await client.query<{ pizzaSize: string | null }>(
          `
            SELECT "pizzaSize"
            FROM "TechnologicalCard"
            WHERE LOWER(REGEXP_REPLACE(TRIM("name"), '\s+', ' ', 'g')) = LOWER($1)
              AND "category" = $2
              AND "pizzaSize" = ANY($3::text[])
          `,
          [input.name, input.category, getPizzaVariantSizes()],
        );

        if (existingVariants.rowCount) {
          const sizes = existingVariants.rows
            .map((row) => row.pizzaSize)
            .filter(Boolean)
            .join(", ");
          throw new ValidationError(
            `Нельзя автоматически создать варианты пиццы: техкарта "${input.name}" уже есть для размеров ${sizes}`,
          );
        }
      }

      if (shouldCreateRollVariants(input)) {
        const existingVariants = await client.query<{ rollSize: string | null }>(
          `
            SELECT "rollSize"
            FROM "TechnologicalCard"
            WHERE LOWER(REGEXP_REPLACE(TRIM("name"), '\s+', ' ', 'g')) = LOWER($1)
              AND "category" = $2
              AND "rollSize" = ANY($3::text[])
          `,
          [input.name, input.category, getRollVariantSizes()],
        );

        if (existingVariants.rowCount) {
          const sizes = existingVariants.rows
            .map((row) => row.rollSize)
            .filter(Boolean)
            .join(", ");
          throw new ValidationError(
            `Нельзя автоматически создать варианты ролла: техкарта "${input.name}" уже есть для ${sizes}`,
          );
        }
      }

      const cardResult = await client.query<TechCardRow>(
        `
          INSERT INTO "TechnologicalCard" ("name", "category", "pizzaSize", "rollSize", "outputQuantity", "outputUnit", "description")
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING "id", "name", "category", "pizzaSize", "rollSize", "outputQuantity", "outputUnit", "description", "createdAt"
        `,
        [
          input.name,
          input.category,
          input.pizzaSize,
          input.rollSize,
          input.outputQuantity,
          input.outputUnit,
          input.description,
        ],
      );

      const card = cardResult.rows[0];
      const ingredients = await insertTechCardIngredients(client, card.id, input.ingredients);
      const variantInputs = [...buildPizzaVariantInputs(input), ...buildRollVariantInputs(input)];

      for (const variantInput of variantInputs) {
        const variantCardResult = await client.query<TechCardRow>(
          `
            INSERT INTO "TechnologicalCard" ("name", "category", "pizzaSize", "rollSize", "outputQuantity", "outputUnit", "description")
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING "id", "name", "category", "pizzaSize", "rollSize", "outputQuantity", "outputUnit", "description", "createdAt"
          `,
          [
            variantInput.name,
            variantInput.category,
            variantInput.pizzaSize,
            variantInput.rollSize,
            variantInput.outputQuantity,
            variantInput.outputUnit,
            variantInput.description,
          ],
        );

        const variantCard = variantCardResult.rows[0];
        await insertTechCardIngredients(client, variantCard.id, variantInput.ingredients);
      }

      await syncIngredientTechCardProduct(client, input);

      return mapTechCardRow(card, ingredients);
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ValidationError(buildDuplicateTechCardMessage(input));
    }

    throw error;
  }
}

export async function updateTechCard(id: number, input: TechCardInput): Promise<TechCardItem | null> {
  try {
    return await withTransaction(async (client) => {
      const existingCard = await client.query<{ id: number; name: string }>(
        `
          SELECT "id", "name"
          FROM "TechnologicalCard"
          WHERE "id" = $1
          LIMIT 1
        `,
        [id],
      );

      if (!existingCard.rowCount) {
        return null;
      }

      const duplicate = await client.query<{ id: number }>(
        `
          SELECT "id"
          FROM "TechnologicalCard"
          WHERE LOWER(REGEXP_REPLACE(TRIM("name"), '\s+', ' ', 'g')) = LOWER($1)
            AND "category" = $2
            AND COALESCE("pizzaSize", '') = COALESCE($3, '')
            AND COALESCE("rollSize", '') = COALESCE($4, '')
            AND "id" <> $5
          LIMIT 1
        `,
        [input.name, input.category, input.pizzaSize, input.rollSize, id],
      );

      if (duplicate.rowCount) {
        throw new ValidationError(buildDuplicateTechCardMessage(input));
      }

      const cardResult = await client.query<TechCardRow>(
        `
          UPDATE "TechnologicalCard"
          SET
            "name" = $2,
            "category" = $3,
            "pizzaSize" = $4,
            "rollSize" = $5,
            "outputQuantity" = $6,
            "outputUnit" = $7,
            "description" = $8
          WHERE "id" = $1
          RETURNING "id", "name", "category", "pizzaSize", "rollSize", "outputQuantity", "outputUnit", "description", "createdAt"
        `,
        [id, input.name, input.category, input.pizzaSize, input.rollSize, input.outputQuantity, input.outputUnit, input.description],
      );

      await client.query(
        `
          DELETE FROM "TechCardIngredient"
          WHERE "technologicalCardId" = $1
        `,
        [id],
      );

      const ingredients = await insertTechCardIngredients(client, id, input.ingredients);
      await syncIngredientTechCardProduct(client, input, existingCard.rows[0]?.name);

      return mapTechCardRow(cardResult.rows[0], ingredients);
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ValidationError(buildDuplicateTechCardMessage(input));
    }

    throw error;
  }
}
