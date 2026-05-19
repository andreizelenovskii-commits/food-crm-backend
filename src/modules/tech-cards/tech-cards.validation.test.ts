import test from "node:test";
import assert from "node:assert/strict";
import { parseTechCardInput } from "@backend/modules/tech-cards/tech-cards.validation";

test("parseTechCardInput keeps decimal output quantities", () => {
  const formData = new FormData();
  formData.set("name", "Тесто базовое");
  formData.set("category", "Ингредиенты");
  formData.set("outputQuantity", "13,200");
  formData.set("outputUnit", "кг");
  formData.append("ingredientProductId", "1");
  formData.append("ingredientQuantity", "8,75");
  formData.append("ingredientUnit", "кг");

  const input = parseTechCardInput(formData);

  assert.equal(input.outputQuantity, 13.2);
  assert.equal(input.outputUnit, "кг");
  assert.deepEqual(input.ingredients, [
    {
      productId: 1,
      quantity: 8.75,
      unit: "кг",
    },
  ]);
});

test("parseTechCardInput allows fractional piece output", () => {
  const formData = new FormData();
  formData.set("name", "Порция соуса");
  formData.set("category", "Ингредиенты");
  formData.set("outputQuantity", "1.5");
  formData.set("outputUnit", "шт");
  formData.append("ingredientProductId", "2");
  formData.append("ingredientQuantity", "0.3");
  formData.append("ingredientUnit", "кг");

  const input = parseTechCardInput(formData);

  assert.equal(input.outputQuantity, 1.5);
  assert.equal(input.outputUnit, "шт");
});
