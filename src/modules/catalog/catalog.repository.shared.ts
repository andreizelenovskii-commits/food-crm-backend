import { pool } from "@backend/shared/db/pool";
import { ValidationError } from "@backend/shared/errors/app-error";
import type {
  CatalogChoiceSlot,
  CatalogItem,
  CatalogPriceListType,
} from "@backend/modules/catalog/catalog.types";
import type { CatalogItemInput } from "@backend/modules/catalog/catalog.validation";

export type CatalogRow = {
  id: number;
  name: string;
  slug: string;
  category: string | null;
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
  input: Pick<CatalogItemInput, "name" | "priceListType" | "technologicalCardId">,
) {
  const baseSlug = slugifyCatalogItemName(input.name) || "catalog-item";

  return `${baseSlug}-${input.priceListType.toLowerCase()}-${input.technologicalCardId}`;
}

export function mapRowToCatalogItem(row: CatalogRow, choiceSlots: CatalogChoiceSlot[] = []): CatalogItem {
  return {
    id: row.id,
    name: row.name,
    priceListType: mapPriceListType(row.isPublished),
    category: row.category,
    pizzaSize: row.pizzaSize,
    rollSize: row.rollSize,
    description: row.description,
    imageUrl: normalizeCatalogImageUrl(row.imageUrl),
    priceCents: row.priceCents,
    createdAt: row.createdAt.toISOString(),
    technologicalCardId: row.technologicalCardId,
    technologicalCardName: row.technologicalCardName,
    choiceSlots,
  };
}

export async function ensureCatalogTechCardExists(input: CatalogItemInput) {
  const result = await pool.query<{ id: number; category: string; pizzaSize: string | null; rollSize: string | null }>(
    `
      SELECT "id", "category", "pizzaSize", "rollSize"
      FROM "TechnologicalCard"
      WHERE "id" = $1
      LIMIT 1
    `,
    [input.technologicalCardId],
  );
  const techCard = result.rows[0];

  if (!techCard) {
    throw new ValidationError("Выбранная технологическая карта не найдена");
  }
}

export async function ensureCatalogPriceListSlot(input: CatalogItemInput, excludeId?: number) {
  const result = await pool.query<{ id: number }>(
    `
      SELECT "id"
      FROM "CatalogItem"
      WHERE "technologicalCardId" = $1
        AND "isPublished" = $2
        AND ($3::int IS NULL OR "id" <> $3)
      LIMIT 1
    `,
    [input.technologicalCardId, input.priceListType === "CLIENT", excludeId ?? null],
  );

  if (result.rowCount) {
    throw new ValidationError("Эта технологическая карта уже добавлена в выбранный прайс");
  }
}
