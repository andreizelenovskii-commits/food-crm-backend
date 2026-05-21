export const TECH_CARD_CATEGORIES = [
  "Роллы",
  "Онигири",
  "Суши-доги",
  "Пиццы",
  "Фаст Фуд",
  "Комбо",
  "Паназиатская кухня",
  "Китайская кухня",
  "Пасты",
  "Сеты",
  "Детское меню",
  "Супы",
  "Салаты",
  "Напитки",
  "Десерты",
  "Ингредиенты",
] as const;

export const INGREDIENT_TECH_CARD_CATEGORY = "Ингредиенты";
export const COMPOSITE_TECH_CARD_CATEGORIES = ["Комбо", "Сеты"] as const;
export const PRICE_TECH_CARD_CATEGORIES = TECH_CARD_CATEGORIES.filter(
  (category) => category !== INGREDIENT_TECH_CARD_CATEGORY,
);
export const SIMPLE_PRICE_TECH_CARD_CATEGORIES = PRICE_TECH_CARD_CATEGORIES.filter(
  (category) => !COMPOSITE_TECH_CARD_CATEGORIES.includes(category as never),
);
export const TECH_CARD_PIZZA_SIZES = ["30 см", "26 см", "24 см"] as const;
export const TECH_CARD_ROLL_SIZES = ["8 шт", "4 шт"] as const;

export type TechCardCategory = (typeof TECH_CARD_CATEGORIES)[number];
export type TechCardPizzaSize = (typeof TECH_CARD_PIZZA_SIZES)[number];
export type TechCardRollSize = (typeof TECH_CARD_ROLL_SIZES)[number];

export type TechCardIngredientItem = {
  id: number;
  productId: number;
  productName: string;
  productUnit: string;
  quantity: number;
  unit: "кг" | "шт";
};

export type TechCardComponentItem = {
  id: number;
  techCardId: number;
  techCardName: string;
  techCardCategory: string;
  pizzaSize: TechCardPizzaSize | null;
  rollSize: TechCardRollSize | null;
  outputQuantity: number;
  outputUnit: string;
  quantity: number;
};

export type TechCardItem = {
  id: number;
  name: string;
  category: TechCardCategory;
  pizzaSize: TechCardPizzaSize | null;
  rollSize: TechCardRollSize | null;
  outputQuantity: number;
  outputUnit: string;
  description: string | null;
  createdAt: string;
  ingredients: TechCardIngredientItem[];
  components: TechCardComponentItem[];
};

export type TechCardProductOption = {
  id: number;
  name: string;
  category: string | null;
  unit: string;
};
