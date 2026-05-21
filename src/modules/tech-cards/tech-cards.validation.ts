import { ValidationError } from "@backend/shared/errors/app-error";
import {
  TECH_CARD_CATEGORIES,
  type TechCardCategory,
  TECH_CARD_PIZZA_SIZES,
  type TechCardPizzaSize,
  TECH_CARD_ROLL_SIZES,
  type TechCardRollSize,
} from "@backend/modules/tech-cards/tech-cards.types";

function normalizeInput(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function parseDecimalInput(value: FormDataEntryValue | null) {
  return Number(normalizeInput(value).replace(",", "."));
}

function normalizeTechCardName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export type TechCardIngredientInput = {
  productId: number;
  quantity: number;
  unit: "кг" | "шт";
};

export type TechCardInput = {
  name: string;
  category: TechCardCategory;
  pizzaSize: TechCardPizzaSize | null;
  rollSize: TechCardRollSize | null;
  autoCreatePizzaVariants: boolean;
  outputQuantity: number;
  outputUnit: "кг" | "шт";
  description: string | null;
  ingredients: TechCardIngredientInput[];
};

export function parseTechCardInput(formData: FormData): TechCardInput {
  const name = normalizeTechCardName(normalizeInput(formData.get("name")));
  const category = normalizeInput(formData.get("category"));
  const pizzaSize = normalizeInput(formData.get("pizzaSize"));
  const rollSize = normalizeInput(formData.get("rollSize"));
  const autoCreatePizzaVariants = normalizeInput(formData.get("autoCreatePizzaVariants")) !== "false";
  const outputQuantity = parseDecimalInput(formData.get("outputQuantity"));
  const outputUnit = normalizeInput(formData.get("outputUnit"));
  const description = normalizeInput(formData.get("description"));
  const ingredientProductIds = formData
    .getAll("ingredientProductId")
    .map((value) => Number(normalizeInput(value)))
    .filter((value) => Number.isFinite(value) && value > 0);
  const ingredientQuantities = formData
    .getAll("ingredientQuantity")
    .map((value) => parseDecimalInput(value));
  const ingredientUnits = formData
    .getAll("ingredientUnit")
    .map((value) => normalizeInput(value));

  if (!name || !category || !outputUnit || !Number.isFinite(outputQuantity) || outputQuantity <= 0) {
    throw new ValidationError("Заполните название, категорию, выход и единицу измерения техкарты");
  }

  if (!TECH_CARD_CATEGORIES.includes(category as TechCardCategory)) {
    throw new ValidationError("Выберите корректную категорию технологической карты");
  }

  if (category === "Пиццы" && !TECH_CARD_PIZZA_SIZES.includes(pizzaSize as TechCardPizzaSize)) {
    throw new ValidationError("Для категории Пиццы выберите размер техкарты");
  }

  if (category !== "Пиццы" && pizzaSize) {
    throw new ValidationError("Размер пиццы можно указывать только для категории Пиццы");
  }

  if (category === "Роллы" && !TECH_CARD_ROLL_SIZES.includes(rollSize as TechCardRollSize)) {
    throw new ValidationError("Для категории Роллы выберите количество штук");
  }

  if (category !== "Роллы" && rollSize) {
    throw new ValidationError("Количество штук можно указывать только для категории Роллы");
  }

  if (outputUnit !== "кг" && outputUnit !== "шт") {
    throw new ValidationError("Единица выхода техкарты должна быть кг или шт");
  }

  if (ingredientProductIds.length === 0) {
    throw new ValidationError("Добавьте хотя бы один ингредиент в технологическую карту");
  }

  if (
    ingredientProductIds.length !== ingredientQuantities.length ||
    ingredientProductIds.length !== ingredientUnits.length
  ) {
    throw new ValidationError("Не удалось обработать список ингредиентов");
  }

  const uniqueProductIds = new Set<number>();
  const ingredients = ingredientProductIds.map<TechCardIngredientInput>((productId, index) => {
    const quantity = ingredientQuantities[index];
    const unit = ingredientUnits[index];

    if (uniqueProductIds.has(productId)) {
      throw new ValidationError("Ингредиенты не должны повторяться в одной техкарте");
    }

    if (unit !== "кг" && unit !== "шт") {
      throw new ValidationError("Для каждого ингредиента выберите единицу кг или шт");
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ValidationError("Количество каждого ингредиента должно быть положительным числом");
    }

    uniqueProductIds.add(productId);

    return {
      productId,
      quantity: Math.round(quantity * 1000) / 1000,
      unit,
    };
  });

  return {
    name,
    category: category as TechCardCategory,
    pizzaSize: category === "Пиццы" ? (pizzaSize as TechCardPizzaSize) : null,
    rollSize: category === "Роллы" ? (rollSize as TechCardRollSize) : null,
    autoCreatePizzaVariants,
    outputQuantity: Math.round(outputQuantity * 1000) / 1000,
    outputUnit,
    description: description || null,
    ingredients,
  };
}
