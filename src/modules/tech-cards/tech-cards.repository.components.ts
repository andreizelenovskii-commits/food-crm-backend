import type { PoolClient } from "pg";
import type {
  TechCardComponentItem,
  TechCardPizzaSize,
  TechCardRollSize,
} from "@backend/modules/tech-cards/tech-cards.types";
import {
  TECH_CARD_PIZZA_SIZES,
  TECH_CARD_ROLL_SIZES,
} from "@backend/modules/tech-cards/tech-cards.types";
import type { TechCardInput } from "@backend/modules/tech-cards/tech-cards.validation";

export type TechCardComponentRow = {
  id: number;
  technologicalCardId: number;
  componentTechnologicalCardId: number;
  techCardName: string;
  techCardCategory: string;
  pizzaSize: string | null;
  rollSize: string | null;
  outputQuantity: number;
  outputUnit: string;
  quantity: number;
};

export function mapTechCardComponentRow(row: TechCardComponentRow): TechCardComponentItem {
  return {
    id: row.id,
    techCardId: row.componentTechnologicalCardId,
    techCardName: row.techCardName,
    techCardCategory: row.techCardCategory,
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
    quantity: row.quantity,
  };
}

export async function insertTechCardComponents(
  client: PoolClient,
  cardId: number,
  components: TechCardInput["components"],
): Promise<TechCardComponentItem[]> {
  const inserted: TechCardComponentItem[] = [];

  for (const component of components) {
    const result = await client.query<TechCardComponentRow>(
      `
        INSERT INTO "TechCardComponent" ("technologicalCardId", "componentTechnologicalCardId", "quantity")
        VALUES ($1, $2, $3)
        RETURNING
          "id",
          "technologicalCardId",
          "componentTechnologicalCardId",
          (SELECT "name" FROM "TechnologicalCard" WHERE "id" = $2) AS "techCardName",
          (SELECT "category" FROM "TechnologicalCard" WHERE "id" = $2) AS "techCardCategory",
          (SELECT "pizzaSize" FROM "TechnologicalCard" WHERE "id" = $2) AS "pizzaSize",
          (SELECT "rollSize" FROM "TechnologicalCard" WHERE "id" = $2) AS "rollSize",
          (SELECT "outputQuantity" FROM "TechnologicalCard" WHERE "id" = $2) AS "outputQuantity",
          (SELECT "outputUnit" FROM "TechnologicalCard" WHERE "id" = $2) AS "outputUnit",
          "quantity"
      `,
      [cardId, component.techCardId, component.quantity],
    );

    inserted.push(mapTechCardComponentRow(result.rows[0]));
  }

  return inserted;
}
