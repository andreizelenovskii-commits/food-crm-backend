import type { PoolClient } from "pg";
import type {
  TechCardChoiceSlotItem,
  TechCardPizzaSize,
} from "@backend/modules/tech-cards/tech-cards.types";
import { TECH_CARD_PIZZA_SIZES } from "@backend/modules/tech-cards/tech-cards.types";
import type { TechCardInput } from "@backend/modules/tech-cards/tech-cards.validation";

export type TechCardChoiceSlotRow = {
  id: number;
  technologicalCardId: number;
  name: string;
  category: string;
  allowedPizzaSizes: string[];
  quantity: number;
};

export function mapTechCardChoiceSlotRow(row: TechCardChoiceSlotRow): TechCardChoiceSlotItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    allowedPizzaSizes: row.allowedPizzaSizes.filter((size): size is TechCardPizzaSize =>
      TECH_CARD_PIZZA_SIZES.includes(size as TechCardPizzaSize),
    ),
    quantity: row.quantity,
  };
}

export async function insertTechCardChoiceSlots(
  client: PoolClient,
  cardId: number,
  choiceSlots: TechCardInput["choiceSlots"],
): Promise<TechCardChoiceSlotItem[]> {
  const inserted: TechCardChoiceSlotItem[] = [];

  for (const slot of choiceSlots) {
    const result = await client.query<TechCardChoiceSlotRow>(
      `
        INSERT INTO "TechCardChoiceSlot" (
          "technologicalCardId",
          "name",
          "category",
          "allowedPizzaSizes",
          "quantity"
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING "id", "technologicalCardId", "name", "category", "allowedPizzaSizes", "quantity"
      `,
      [cardId, slot.name, slot.category, slot.allowedPizzaSizes, slot.quantity],
    );

    inserted.push(mapTechCardChoiceSlotRow(result.rows[0]));
  }

  return inserted;
}
