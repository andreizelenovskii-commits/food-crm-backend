export const TECH_CARD_CATEGORIES = [
  "Роллы",
  "Пиццы",
  "Фаст Фуд",
  "Комбо",
  "Китайская кухня",
  "Сеты",
  "Детское комбо",
  "Напитки",
  "Десерты",
  "Ингредиенты",
] as const;

export const INGREDIENT_TECH_CARD_CATEGORY = "Ингредиенты";
export const PRICE_TECH_CARD_CATEGORIES = TECH_CARD_CATEGORIES.filter(
  (category) => category !== INGREDIENT_TECH_CARD_CATEGORY,
);
export const TECH_CARD_PIZZA_SIZES = ["30 см", "26 см", "24 см"] as const;

export type TechCardCategory = (typeof TECH_CARD_CATEGORIES)[number];
export type TechCardPizzaSize = (typeof TECH_CARD_PIZZA_SIZES)[number];

export type TechCardIngredientItem = {
  id: number;
  productId: number;
  productName: string;
  productUnit: string;
  quantity: number;
  unit: "кг" | "шт";
};

export type TechCardItem = {
  id: number;
  name: string;
  category: TechCardCategory;
  pizzaSize: TechCardPizzaSize | null;
  outputQuantity: number;
  outputUnit: string;
  description: string | null;
  createdAt: string;
  ingredients: TechCardIngredientItem[];
};

export type TechCardProductOption = {
  id: number;
  name: string;
  category: string | null;
  unit: string;
};
