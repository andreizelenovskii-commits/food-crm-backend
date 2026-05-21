import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRollVariantInputs,
  scaleRollIngredientQuantity,
  shouldCreateRollVariants,
} from "@backend/modules/tech-cards/tech-cards.roll-variants";
import type { TechCardInput } from "@backend/modules/tech-cards/tech-cards.validation";

const baseRollInput: TechCardInput = {
  name: "Курай",
  category: "Роллы",
  pizzaSize: null,
  rollSize: "8 шт",
  autoCreatePizzaVariants: true,
  autoCreateRollVariants: true,
  outputQuantity: 1,
  outputUnit: "шт",
  description: null,
  components: [],
  choiceSlots: [],
  ingredients: [
    { productId: 1, quantity: 0.2, unit: "кг" },
    { productId: 2, quantity: 0.5, unit: "шт" },
  ],
};

test("roll variants are created only from 8 piece roll tech cards", () => {
  assert.equal(shouldCreateRollVariants(baseRollInput), true);
  assert.equal(shouldCreateRollVariants({ ...baseRollInput, autoCreateRollVariants: false }), false);
  assert.equal(shouldCreateRollVariants({ ...baseRollInput, rollSize: "4 шт" }), false);
  assert.equal(shouldCreateRollVariants({ ...baseRollInput, category: "Пиццы", pizzaSize: "30 см", rollSize: null }), false);
});

test("roll ingredient quantities scale by 50 percent for 4 piece variants", () => {
  const variants = buildRollVariantInputs(baseRollInput);

  assert.equal(variants.length, 1);
  assert.equal(variants[0]?.rollSize, "4 шт");
  assert.equal(variants[0]?.ingredients[0]?.quantity, 0.1);
  assert.equal(variants[0]?.ingredients[1]?.quantity, 0.25);
});

test("roll ingredient scaling keeps three decimal precision", () => {
  assert.equal(scaleRollIngredientQuantity(0.333), 0.167);
});
