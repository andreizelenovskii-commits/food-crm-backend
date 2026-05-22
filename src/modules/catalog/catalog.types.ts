export const CATALOG_PRICE_LIST_TYPES = ["CLIENT", "INTERNAL"] as const;
export const CATALOG_SITE_CATEGORIES = [
  "Пицца",
  "Роллы",
  "Онигири",
  "Суши-доги",
  "Фастфуд",
  "Пасты",
  "Пасты и салаты",
  "Паназиатская кухня",
  "Напитки",
  "Десерты",
  "Детское меню",
  "Комбо",
  "Сеты",
] as const;

export type CatalogPriceListType = (typeof CATALOG_PRICE_LIST_TYPES)[number];
export type CatalogSiteCategory = (typeof CATALOG_SITE_CATEGORIES)[number];

export const CATALOG_PRICE_LIST_LABELS: Record<CatalogPriceListType, string> = {
  CLIENT: "Клиентский прайс",
  INTERNAL: "Внутренний прайс",
};

export type CatalogItem = {
  id: number;
  name: string;
  priceListType: CatalogPriceListType;
  category: string | null;
  kitchenZone: "pizza" | "rolls" | "fastfood" | null;
  pizzaSize: string | null;
  rollSize: string | null;
  description: string | null;
  imageUrl: string | null;
  priceCents: number;
  createdAt: string;
  technologicalCardId: number;
  technologicalCardName: string;
  variants: CatalogItemVariant[];
  choiceSlots: CatalogChoiceSlot[];
};

export type CatalogItemVariant = {
  id: number;
  label: string;
  priceCents: number;
  isDefault: boolean;
  displayOrder: number;
  technologicalCardId: number;
  technologicalCardName: string;
  pizzaSize: string | null;
  rollSize: string | null;
};

export type CatalogChoiceOption = {
  catalogItemId: number;
  name: string;
  category: string | null;
  pizzaSize: string | null;
  rollSize: string | null;
};

export type CatalogChoiceSlot = {
  id: number;
  name: string;
  category: string;
  allowedPizzaSizes: string[];
  quantity: number;
  options: CatalogChoiceOption[];
};
