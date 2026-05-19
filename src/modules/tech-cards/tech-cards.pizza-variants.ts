import type { TechCardInput } from "@backend/modules/tech-cards/tech-cards.validation";

const PIZZA_CATEGORY = "Пиццы";
const BASE_PIZZA_SIZE = "30 см";
const VARIANT_SIZES = ["26 см", "24 см"] as const;
const PIZZA_SIZE_FACTOR = 0.85;

export function shouldCreatePizzaVariants(input: TechCardInput) {
  return input.category === PIZZA_CATEGORY && input.pizzaSize === BASE_PIZZA_SIZE;
}

export function getPizzaVariantSizes() {
  return VARIANT_SIZES;
}

export function buildPizzaVariantInputs(input: TechCardInput): TechCardInput[] {
  if (!shouldCreatePizzaVariants(input)) {
    return [];
  }

  let previousIngredients = input.ingredients;

  return VARIANT_SIZES.map((pizzaSize) => {
    const ingredients = previousIngredients.map((ingredient) => ({
      ...ingredient,
      quantity: scalePizzaIngredientQuantity(ingredient.quantity, ingredient.unit),
    }));
    previousIngredients = ingredients;

    return {
      ...input,
      pizzaSize,
      ingredients,
    };
  });
}

export function scalePizzaIngredientQuantity(quantity: number, unit: "кг" | "шт") {
  const scaled = quantity * PIZZA_SIZE_FACTOR;

  if (unit === "шт") {
    return Math.max(1, Math.round(scaled));
  }

  const grams = scaled * 1000;
  const roundedGrams = Number.isInteger(grams)
    ? grams
    : Math.round(grams / 10) * 10;

  return Math.max(0.001, Math.round(roundedGrams) / 1000);
}
