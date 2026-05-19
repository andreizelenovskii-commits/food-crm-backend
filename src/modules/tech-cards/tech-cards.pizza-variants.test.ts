import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPizzaVariantInputs,
  scalePizzaIngredientQuantity,
  shouldCreatePizzaVariants,
} from "@backend/modules/tech-cards/tech-cards.pizza-variants";
import type { TechCardInput } from "@backend/modules/tech-cards/tech-cards.validation";

const basePizzaInput: TechCardInput = {
  name: "Маргарита",
  category: "Пиццы",
  pizzaSize: "30 см",
  outputQuantity: 1,
  outputUnit: "шт",
  description: null,
  ingredients: [
    { productId: 1, quantity: 0.3, unit: "кг" },
    { productId: 2, quantity: 2, unit: "шт" },
  ],
};

test("pizza variants are created only from 30 cm pizza tech cards", () => {
  assert.equal(shouldCreatePizzaVariants(basePizzaInput), true);
  assert.equal(shouldCreatePizzaVariants({ ...basePizzaInput, pizzaSize: "26 см" }), false);
  assert.equal(shouldCreatePizzaVariants({ ...basePizzaInput, category: "Роллы", pizzaSize: null }), false);
});

test("pizza ingredient quantities scale by 15 percent for 26 and 24 cm variants", () => {
  const variants = buildPizzaVariantInputs(basePizzaInput);

  assert.equal(variants.length, 2);
  assert.equal(variants[0]?.pizzaSize, "26 см");
  assert.equal(variants[1]?.pizzaSize, "24 см");
  assert.equal(variants[0]?.ingredients[0]?.quantity, 0.255);
  assert.equal(variants[1]?.ingredients[0]?.quantity, 0.22);
  assert.equal(variants[0]?.ingredients[1]?.quantity, 2);
  assert.equal(variants[1]?.ingredients[1]?.quantity, 2);
});

test("pizza ingredient scaling matches dough rounding example", () => {
  assert.equal(scalePizzaIngredientQuantity(0.3, "кг"), 0.255);
  assert.equal(scalePizzaIngredientQuantity(0.255, "кг"), 0.22);
});
