import { pool } from "@backend/shared/db/pool";
import { ValidationError } from "@backend/shared/errors/app-error";
import type {
  CatalogChoiceSlot,
  CatalogItemExcludedIngredient,
  CatalogItem,
  CatalogItemVariant,
  CatalogPriceListType,
} from "@backend/modules/catalog/catalog.types";
import type { CatalogItemInput } from "@backend/modules/catalog/catalog.validation";

export type CatalogRow = {
  id: number;
  name: string;
  slug: string;
  category: string | null;
  kitchenZone: "pizza" | "rolls" | "fastfood" | null;
  pizzaSize: string | null;
  rollSize: string | null;
  description: string | null;
  imageUrl: string | null;
  priceCents: number;
  isPublished: boolean;
  createdAt: Date;
  technologicalCardId: number;
  technologicalCardName: string;
};

export type CatalogVariantRow = {
  id: number;
  catalogItemId: number;
  label: string;
  priceCents: number;
  isDefault: boolean;
  displayOrder: number;
  technologicalCardId: number;
  technologicalCardName: string;
  pizzaSize: string | null;
  rollSize: string | null;
};

export type CatalogExcludedIngredientRow = {
  id: number;
  catalogItemId: number;
  productId: number;
  productName: string;
  label: string;
  displayOrder: number;
};

function slugifyCatalogItemName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function mapPriceListType(isPublished: boolean): CatalogPriceListType {
  return isPublished ? "CLIENT" : "INTERNAL";
}

function normalizeCatalogImageUrl(imageUrl: string | null) {
  if (!imageUrl) {
    return null;
  }

  if (imageUrl.startsWith("/uploads/catalog/")) {
    return imageUrl;
  }

  try {
    const url = new URL(imageUrl);

    if (url.pathname.startsWith("/uploads/catalog/")) {
      return url.pathname;
    }
  } catch {
    return imageUrl;
  }

  return imageUrl;
}

export function buildCatalogSlug(
  input: Pick<CatalogItemInput, "name" | "category" | "priceListType">,
) {
  const baseSlug = slugifyCatalogItemName(`${input.name}-${input.category}`) || "catalog-item";

  return `${baseSlug}-${input.priceListType.toLowerCase()}`;
}

export function mapRowToCatalogItem(
  row: CatalogRow,
  choiceSlots: CatalogChoiceSlot[] = [],
  variants: CatalogItemVariant[] = [],
  excludedIngredients: CatalogItemExcludedIngredient[] = [],
): CatalogItem {
  return {
    id: row.id,
    name: row.name,
    priceListType: mapPriceListType(row.isPublished),
    category: row.category,
    kitchenZone: row.kitchenZone,
    pizzaSize: row.pizzaSize,
    rollSize: row.rollSize,
    description: row.description,
    imageUrl: normalizeCatalogImageUrl(row.imageUrl),
    priceCents: row.priceCents,
    createdAt: row.createdAt.toISOString(),
    technologicalCardId: row.technologicalCardId,
    technologicalCardName: row.technologicalCardName,
    variants,
    excludedIngredients,
    choiceSlots,
  };
}

export function mapRowToCatalogExcludedIngredient(row: CatalogExcludedIngredientRow): CatalogItemExcludedIngredient {
  return {
    id: row.id,
    productId: row.productId,
    productName: row.productName,
    label: row.label,
    displayOrder: row.displayOrder,
  };
}

export function mapRowToCatalogVariant(row: CatalogVariantRow): CatalogItemVariant {
  return {
    id: row.id,
    label: row.label,
    priceCents: row.priceCents,
    isDefault: row.isDefault,
    displayOrder: row.displayOrder,
    technologicalCardId: row.technologicalCardId,
    technologicalCardName: row.technologicalCardName,
    pizzaSize: row.pizzaSize,
    rollSize: row.rollSize,
  };
}

export async function ensureCatalogTechCardExists(input: CatalogItemInput) {
  const techCardIds = input.variants.map((variant) => variant.technologicalCardId);
  const result = await pool.query<{ id: number; category: string; pizzaSize: string | null; rollSize: string | null }>(
    `
      SELECT "id", "category", "pizzaSize", "rollSize"
      FROM "TechnologicalCard"
      WHERE "id" = ANY($1::int[])
    `,
    [techCardIds],
  );

  if (result.rows.length !== techCardIds.length) {
    throw new ValidationError("Одна из выбранных технологических карт не найдена");
  }
}

export async function ensureCatalogExcludedIngredientProductsExist(input: CatalogItemInput) {
  const productIds = input.excludedIngredients.map((ingredient) => ingredient.productId);

  if (!productIds.length) {
    return;
  }

  const result = await pool.query<{ id: number }>(
    `
      SELECT "id"
      FROM "Product"
      WHERE "id" = ANY($1::int[])
    `,
    [productIds],
  );

  if (result.rows.length !== productIds.length) {
    throw new ValidationError("Один из исключаемых ингредиентов не найден на складе");
  }
}

export async function ensureCatalogPriceListSlot(input: CatalogItemInput, excludeId?: number) {
  const result = await pool.query<{ id: number }>(
    `
      SELECT "id"
      FROM "CatalogItem"
      WHERE "slug" = $1
        AND "isPublished" = $2
        AND ($3::int IS NULL OR "id" <> $3)
      LIMIT 1
    `,
    [buildCatalogSlug(input), input.priceListType === "CLIENT", excludeId ?? null],
  );

  if (result.rowCount) {
    throw new ValidationError("Карточка с таким названием уже есть в выбранном прайсе");
  }
}
