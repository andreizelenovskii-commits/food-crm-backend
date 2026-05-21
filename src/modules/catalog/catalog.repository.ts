import { pool } from "@backend/shared/db/pool";
import { ensureRecentDatabaseBackup } from "@backend/shared/db/backup";
import type { CatalogItemInput } from "@backend/modules/catalog/catalog.validation";
import type { CatalogChoiceSlot, CatalogItem } from "@backend/modules/catalog/catalog.types";
import {
  buildCatalogSlug,
  ensureCatalogPriceListSlot,
  ensureCatalogTechCardExists,
  mapRowToCatalogItem,
  type CatalogRow,
} from "@backend/modules/catalog/catalog.repository.shared";

type CatalogChoiceSlotRow = {
  id: number;
  technologicalCardId: number;
  name: string;
  category: string;
  allowedPizzaSizes: string[];
  quantity: number;
};

type CatalogChoiceOptionRow = {
  choiceSlotId: number;
  catalogItemId: number;
  name: string;
  category: string | null;
  pizzaSize: string | null;
  rollSize: string | null;
};

async function hydrateCatalogChoiceSlots(rows: CatalogRow[], publishedOnly: boolean) {
  const techCardIds = rows.map((row) => row.technologicalCardId);

  if (techCardIds.length === 0) {
    return new Map<number, CatalogChoiceSlot[]>();
  }

  const slotsResult = await pool.query<CatalogChoiceSlotRow>(
    `
      SELECT "id", "technologicalCardId", "name", "category", "allowedPizzaSizes", "quantity"
      FROM "TechCardChoiceSlot"
      WHERE "technologicalCardId" = ANY($1::int[])
      ORDER BY "id" ASC
    `,
    [techCardIds],
  );
  const slots = slotsResult.rows;

  if (slots.length === 0) {
    return new Map<number, CatalogChoiceSlot[]>();
  }

  const optionsResult = await pool.query<CatalogChoiceOptionRow>(
    `
      SELECT
        s."id" AS "choiceSlotId",
        c."id" AS "catalogItemId",
        c."name",
        c."category",
        t."pizzaSize",
        t."rollSize"
      FROM "TechCardChoiceSlot" s
      INNER JOIN "TechnologicalCard" t ON t."category" = s."category"
        AND (
          CARDINALITY(s."allowedPizzaSizes") = 0
          OR t."pizzaSize" = ANY(s."allowedPizzaSizes")
        )
      INNER JOIN "CatalogItem" c ON c."technologicalCardId" = t."id"
        AND c."isPublished" = $2
      WHERE s."id" = ANY($1::int[])
      ORDER BY c."category" ASC NULLS LAST, c."name" ASC, t."pizzaSize" ASC NULLS LAST
    `,
    [slots.map((slot) => slot.id), publishedOnly],
  );
  const optionsBySlot = optionsResult.rows.reduce<Record<number, CatalogChoiceOptionRow[]>>(
    (acc, option) => {
      const current = acc[option.choiceSlotId] ?? [];
      current.push(option);
      acc[option.choiceSlotId] = current;
      return acc;
    },
    {},
  );

  return slots.reduce<Map<number, CatalogChoiceSlot[]>>((acc, slot) => {
    const current = acc.get(slot.technologicalCardId) ?? [];
    current.push({
      id: slot.id,
      name: slot.name,
      category: slot.category,
      allowedPizzaSizes: slot.allowedPizzaSizes,
      quantity: slot.quantity,
      options: (optionsBySlot[slot.id] ?? []).map((option) => ({
        catalogItemId: option.catalogItemId,
        name: option.name,
        category: option.category,
        pizzaSize: option.pizzaSize,
        rollSize: option.rollSize,
      })),
    });
    acc.set(slot.technologicalCardId, current);
    return acc;
  }, new Map<number, CatalogChoiceSlot[]>());
}

export async function getCatalogItems(): Promise<CatalogItem[]> {
  const result = await pool.query<CatalogRow>(
    `
      SELECT
        c."id",
        c."name",
        c."slug",
        c."category",
        t."pizzaSize",
        t."rollSize",
        c."description",
        c."imageUrl",
        c."priceCents",
        c."isPublished",
        c."createdAt",
        c."technologicalCardId",
        t."name" AS "technologicalCardName"
      FROM "CatalogItem" c
      INNER JOIN "TechnologicalCard" t ON t."id" = c."technologicalCardId"
      ORDER BY c."category" ASC NULLS LAST, c."createdAt" DESC
    `,
  );

  const choiceSlotsByCard = await hydrateCatalogChoiceSlots(result.rows, false);

  return result.rows.map((row) => mapRowToCatalogItem(row, choiceSlotsByCard.get(row.technologicalCardId) ?? []));
}

export async function getPublicCatalogItems(): Promise<CatalogItem[]> {
  const result = await pool.query<CatalogRow>(
    `
      SELECT
        c."id",
        c."name",
        c."slug",
        c."category",
        t."pizzaSize",
        t."rollSize",
        c."description",
        c."imageUrl",
        c."priceCents",
        c."isPublished",
        c."createdAt",
        c."technologicalCardId",
        t."name" AS "technologicalCardName"
      FROM "CatalogItem" c
      INNER JOIN "TechnologicalCard" t ON t."id" = c."technologicalCardId"
      WHERE c."isPublished" = TRUE
      ORDER BY c."category" ASC NULLS LAST, c."createdAt" DESC
    `,
  );

  const choiceSlotsByCard = await hydrateCatalogChoiceSlots(result.rows, true);

  return result.rows.map((row) => mapRowToCatalogItem(row, choiceSlotsByCard.get(row.technologicalCardId) ?? []));
}

export async function getCatalogItemById(id: number): Promise<CatalogItem | null> {
  const result = await pool.query<CatalogRow>(
    `
      SELECT
        c."id",
        c."name",
        c."slug",
        c."category",
        t."pizzaSize",
        t."rollSize",
        c."description",
        c."imageUrl",
        c."priceCents",
        c."isPublished",
        c."createdAt",
        c."technologicalCardId",
        t."name" AS "technologicalCardName"
      FROM "CatalogItem" c
      INNER JOIN "TechnologicalCard" t ON t."id" = c."technologicalCardId"
      WHERE c."id" = $1
      LIMIT 1
    `,
    [id],
  );

  if (!result.rowCount) {
    return null;
  }

  const choiceSlotsByCard = await hydrateCatalogChoiceSlots(result.rows, result.rows[0].isPublished);

  return mapRowToCatalogItem(result.rows[0], choiceSlotsByCard.get(result.rows[0].technologicalCardId) ?? []);
}

export async function createCatalogItem(input: CatalogItemInput): Promise<CatalogItem> {
  await ensureCatalogTechCardExists(input);
  await ensureCatalogPriceListSlot(input);
  const slug = buildCatalogSlug(input);

  await ensureRecentDatabaseBackup("catalog-item-create");
  const result = await pool.query<CatalogRow>(
    `
      INSERT INTO "CatalogItem" (
        "name",
        "slug",
        "category",
        "description",
        "imageUrl",
        "priceCents",
        "isPublished",
        "technologicalCardId"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        "id",
        "name",
        "slug",
        "category",
        (SELECT "pizzaSize" FROM "TechnologicalCard" WHERE "id" = $8) AS "pizzaSize",
        (SELECT "rollSize" FROM "TechnologicalCard" WHERE "id" = $8) AS "rollSize",
        "description",
        "imageUrl",
        "priceCents",
        "isPublished",
        "createdAt",
        "technologicalCardId",
        (SELECT "name" FROM "TechnologicalCard" WHERE "id" = $8) AS "technologicalCardName"
    `,
    [
      input.name,
      slug,
      input.category,
      input.description,
      input.imageUrl,
      input.priceCents,
      input.priceListType === "CLIENT",
      input.technologicalCardId,
    ],
  );

  return mapRowToCatalogItem(result.rows[0]);
}

export async function updateCatalogItem(
  id: number,
  input: CatalogItemInput,
): Promise<CatalogItem | null> {
  await ensureCatalogTechCardExists(input);
  await ensureCatalogPriceListSlot(input, id);
  const slug = buildCatalogSlug(input);

  await ensureRecentDatabaseBackup("catalog-item-update");
  const result = await pool.query<CatalogRow>(
    `
      UPDATE "CatalogItem"
      SET
        "name" = $2,
        "slug" = $3,
        "category" = $4,
        "description" = $5,
        "imageUrl" = $6,
        "priceCents" = $7,
        "isPublished" = $8,
        "technologicalCardId" = $9
      WHERE "id" = $1
      RETURNING
        "id",
        "name",
        "slug",
        "category",
        (SELECT "pizzaSize" FROM "TechnologicalCard" WHERE "id" = $9) AS "pizzaSize",
        (SELECT "rollSize" FROM "TechnologicalCard" WHERE "id" = $9) AS "rollSize",
        "description",
        "imageUrl",
        "priceCents",
        "isPublished",
        "createdAt",
        "technologicalCardId",
        (SELECT "name" FROM "TechnologicalCard" WHERE "id" = $9) AS "technologicalCardName"
    `,
    [
      id,
      input.name,
      slug,
      input.category,
      input.description,
      input.imageUrl,
      input.priceCents,
      input.priceListType === "CLIENT",
      input.technologicalCardId,
    ],
  );

  if (!result.rowCount) {
    return null;
  }

  return mapRowToCatalogItem(result.rows[0]);
}

export async function deleteCatalogItem(id: number): Promise<boolean> {
  await ensureRecentDatabaseBackup("catalog-item-delete");
  const result = await pool.query(
    `
      DELETE FROM "CatalogItem"
      WHERE "id" = $1
    `,
    [id],
  );

  return (result.rowCount ?? 0) > 0;
}
