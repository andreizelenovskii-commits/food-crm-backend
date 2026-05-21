import type { TechCardInput } from "@backend/modules/tech-cards/tech-cards.validation";

const ROLL_CATEGORY = "Роллы";
const BASE_ROLL_SIZE = "8 шт";
const VARIANT_SIZES = ["4 шт"] as const;
const ROLL_SIZE_FACTOR = 0.5;

export function shouldCreateRollVariants(input: TechCardInput) {
  return input.autoCreateRollVariants && input.category === ROLL_CATEGORY && input.rollSize === BASE_ROLL_SIZE;
}

export function getRollVariantSizes() {
  return VARIANT_SIZES;
}

export function buildRollVariantInputs(input: TechCardInput): TechCardInput[] {
  if (!shouldCreateRollVariants(input)) {
    return [];
  }

  return VARIANT_SIZES.map((rollSize) => ({
    ...input,
    rollSize,
    ingredients: input.ingredients.map((ingredient) => ({
      ...ingredient,
      quantity: scaleRollIngredientQuantity(ingredient.quantity),
    })),
  }));
}

export function scaleRollIngredientQuantity(quantity: number) {
  return Math.max(0.001, Math.round(quantity * ROLL_SIZE_FACTOR * 1000) / 1000);
}
