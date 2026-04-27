import { ValidationError } from "@backend/shared/errors/app-error";
import {
  CATALOG_PRICE_LIST_TYPES,
  type CatalogPriceListType,
} from "@backend/modules/catalog/catalog.types";
import {
  TECH_CARD_CATEGORIES,
  type TechCardCategory,
} from "@backend/modules/tech-cards/tech-cards.types";

function normalizeInput(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export type CatalogItemInput = {
  name: string;
  priceListType: CatalogPriceListType;
  category: TechCardCategory;
  description: string | null;
  priceCents: number;
  technologicalCardId: number;
};

export function parseCatalogItemInput(formData: FormData): CatalogItemInput {
  const name = normalizeInput(formData.get("name"));
  const priceListType = normalizeInput(formData.get("priceListType"));
  const category = normalizeInput(formData.get("category"));
  const description = normalizeInput(formData.get("description"));
  const price = Number(normalizeInput(formData.get("price")));
  const technologicalCardId = Number(normalizeInput(formData.get("technologicalCardId")));

  if (!name || !priceListType || !category || !Number.isFinite(price) || price < 0) {
    throw new ValidationError("Заполните название, прайс, категорию и цену позиции каталога");
  }

  if (!CATALOG_PRICE_LIST_TYPES.includes(priceListType as CatalogPriceListType)) {
    throw new ValidationError("Выберите корректный тип прайса");
  }

  if (!TECH_CARD_CATEGORIES.includes(category as TechCardCategory)) {
    throw new ValidationError("Выберите категорию из списка технологических карт");
  }

  if (!Number.isInteger(technologicalCardId) || technologicalCardId <= 0) {
    throw new ValidationError("Позиция каталога должна быть привязана к технологической карте");
  }

  return {
    name,
    priceListType: priceListType as CatalogPriceListType,
    category: category as TechCardCategory,
    description: description || null,
    priceCents: Math.round(price * 100),
    technologicalCardId,
  };
}
