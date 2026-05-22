import { ValidationError } from "@backend/shared/errors/app-error";
import {
  CATALOG_SITE_CATEGORIES,
  CATALOG_PRICE_LIST_TYPES,
  type CatalogSiteCategory,
  type CatalogPriceListType,
} from "@backend/modules/catalog/catalog.types";
import { KITCHEN_ZONES, type KitchenZone } from "@backend/modules/inventory/inventory.types";

function normalizeInput(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export type CatalogItemInput = {
  name: string;
  priceListType: CatalogPriceListType;
  category: CatalogSiteCategory;
  kitchenZone: KitchenZone;
  description: string | null;
  imageUrl: string;
  priceCents: number;
  technologicalCardId: number;
  variants: CatalogVariantInput[];
  excludedIngredients: CatalogExcludedIngredientInput[];
};

export type CatalogExcludedIngredientInput = {
  productId: number;
  label: string;
  displayOrder: number;
};

export type CatalogVariantInput = {
  technologicalCardId: number;
  label: string;
  priceCents: number;
  isDefault: boolean;
  displayOrder: number;
};

function isValidImageUrl(value: string) {
  if (value.startsWith("/")) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function parseCatalogItemInput(formData: FormData): CatalogItemInput {
  const name = normalizeInput(formData.get("name"));
  const priceListType = normalizeInput(formData.get("priceListType"));
  const category = normalizeInput(formData.get("category"));
  const kitchenZone = normalizeInput(formData.get("kitchenZone"));
  const description = normalizeInput(formData.get("description"));
  const imageUrl = normalizeInput(formData.get("imageUrl"));
  const price = Number(normalizeInput(formData.get("price")));
  const technologicalCardId = Number(normalizeInput(formData.get("technologicalCardId")));
  const variants = parseCatalogVariants(formData);
  const excludedIngredients = normalizeExcludedIngredients(parseCatalogExcludedIngredients(formData));

  if (!name || !priceListType || !category || !kitchenZone || !imageUrl) {
    throw new ValidationError("Заполните название, прайс, категорию, кухонную зону и фото позиции каталога");
  }

  if (!CATALOG_PRICE_LIST_TYPES.includes(priceListType as CatalogPriceListType)) {
    throw new ValidationError("Выберите корректный тип прайса");
  }

  if (!CATALOG_SITE_CATEGORIES.includes(category as CatalogSiteCategory)) {
    throw new ValidationError("Выберите категорию сайта из списка");
  }

  if (!KITCHEN_ZONES.includes(kitchenZone as KitchenZone)) {
    throw new ValidationError("Выберите кухонную зону из списка");
  }

  if (!isValidImageUrl(imageUrl)) {
    throw new ValidationError("Укажите корректную ссылку или путь к фото товара");
  }

  if (variants.length === 0 && (!Number.isInteger(technologicalCardId) || technologicalCardId <= 0 || !Number.isFinite(price) || price < 0)) {
    throw new ValidationError("Добавьте хотя бы один вариант с техкартой и ценой");
  }

  const normalizedVariants = variants.length > 0
    ? normalizeVariants(variants)
    : normalizeVariants([{
        technologicalCardId,
        label: "Стандарт",
        priceCents: Math.round(price * 100),
        isDefault: true,
        displayOrder: 0,
      }]);

  return {
    name,
    priceListType: priceListType as CatalogPriceListType,
    category: category as CatalogSiteCategory,
    kitchenZone: kitchenZone as KitchenZone,
    description: description || null,
    imageUrl,
    priceCents: normalizedVariants.find((variant) => variant.isDefault)?.priceCents ?? normalizedVariants[0].priceCents,
    technologicalCardId: normalizedVariants.find((variant) => variant.isDefault)?.technologicalCardId ?? normalizedVariants[0].technologicalCardId,
    variants: normalizedVariants,
    excludedIngredients,
  };
}

function parseCatalogExcludedIngredients(formData: FormData): CatalogExcludedIngredientInput[] {
  const raw = normalizeInput(formData.get("excludedIngredients"));

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Array<{
      productId: number;
      label: string;
      displayOrder?: number;
    }>;

    return parsed.map((ingredient, index) => ({
      productId: Number(ingredient.productId),
      label: String(ingredient.label ?? "").trim(),
      displayOrder: Number.isInteger(ingredient.displayOrder) ? Number(ingredient.displayOrder) : index,
    }));
  } catch {
    throw new ValidationError("Не удалось прочитать исключаемые ингредиенты");
  }
}

function parseCatalogVariants(formData: FormData): CatalogVariantInput[] {
  const raw = normalizeInput(formData.get("variants"));

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Array<{
      technologicalCardId: number;
      label: string;
      price: string | number;
      isDefault?: boolean;
      displayOrder?: number;
    }>;

    return parsed.map((variant, index) => ({
      technologicalCardId: Number(variant.technologicalCardId),
      label: String(variant.label ?? "").trim(),
      priceCents: Math.round(Number(variant.price) * 100),
      isDefault: Boolean(variant.isDefault),
      displayOrder: Number.isInteger(variant.displayOrder) ? Number(variant.displayOrder) : index,
    }));
  } catch {
    throw new ValidationError("Не удалось прочитать варианты карточки");
  }
}

function normalizeVariants(variants: CatalogVariantInput[]) {
  if (variants.length === 0) {
    throw new ValidationError("Добавьте хотя бы один вариант");
  }

  const techCardIds = new Set<number>();
  const defaultCount = variants.filter((variant) => variant.isDefault).length;

  if (defaultCount > 1) {
    throw new ValidationError("В карточке может быть только один вариант по умолчанию");
  }

  return variants.map((variant, index) => {
    if (!Number.isInteger(variant.technologicalCardId) || variant.technologicalCardId <= 0) {
      throw new ValidationError("У каждого варианта должна быть технологическая карта");
    }

    if (techCardIds.has(variant.technologicalCardId)) {
      throw new ValidationError("Одна техкарта не может повторяться в вариантах карточки");
    }

    if (!variant.label) {
      throw new ValidationError("У каждого варианта должна быть подпись");
    }

    if (!Number.isInteger(variant.priceCents) || variant.priceCents < 0) {
      throw new ValidationError("У каждого варианта должна быть корректная цена");
    }

    techCardIds.add(variant.technologicalCardId);

    return {
      ...variant,
      isDefault: defaultCount === 0 ? index === 0 : variant.isDefault,
      displayOrder: index,
    };
  });
}

function normalizeExcludedIngredients(excludedIngredients: CatalogExcludedIngredientInput[]) {
  const productIds = new Set<number>();

  return excludedIngredients.map((ingredient, index) => {
    if (!Number.isInteger(ingredient.productId) || ingredient.productId <= 0) {
      throw new ValidationError("У каждого исключаемого ингредиента должен быть продукт склада");
    }

    if (productIds.has(ingredient.productId)) {
      throw new ValidationError("Один ингредиент нельзя добавить в исключения дважды");
    }

    if (!ingredient.label) {
      throw new ValidationError("У каждого исключаемого ингредиента должна быть подпись для сайта");
    }

    productIds.add(ingredient.productId);

    return {
      ...ingredient,
      displayOrder: index,
    };
  });
}
