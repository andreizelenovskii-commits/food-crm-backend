import type { PoolClient } from "pg";
import { pool } from "@backend/shared/db/pool";
import { ensureRecentDatabaseBackup } from "@backend/shared/db/backup";
import { withTransaction } from "@backend/shared/db/transaction";
import type { CatalogItemInput } from "@backend/modules/catalog/catalog.validation";
import type { CatalogChoiceSlot, CatalogItem } from "@backend/modules/catalog/catalog.types";
import {
  buildCatalogSlug,
  ensureCatalogExcludedIngredientProductsExist,
  ensureCatalogPriceListSlot,
  ensureCatalogTechCardExists,
  mapRowToCatalogExcludedIngredient,
  mapRowToCatalogVariant,
  mapRowToCatalogItem,
  type CatalogExcludedIngredientRow,
  type CatalogVariantRow,
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
  imageUrl: string | null;
  priceCents: number;
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
        c."imageUrl",
        c."priceCents",
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
        imageUrl: option.imageUrl,
        priceCents: option.priceCents,
        pizzaSize: option.pizzaSize,
        rollSize: option.rollSize,
      })),
    });
    acc.set(slot.technologicalCardId, current);
    return acc;
  }, new Map<number, CatalogChoiceSlot[]>());
}

async function hydrateCatalogVariants(rows: CatalogRow[]) {
  const catalogItemIds = rows.map((row) => row.id);

  if (!catalogItemIds.length) {
    return new Map<number, ReturnType<typeof mapRowToCatalogVariant>[]>();
  }

  const result = await pool.query<CatalogVariantRow>(
    `
      SELECT
        v."id",
        v."catalogItemId",
        v."label",
        v."priceCents",
        v."isDefault",
        v."displayOrder",
        v."technologicalCardId",
        t."name" AS "technologicalCardName",
        t."pizzaSize",
        t."rollSize"
      FROM "CatalogItemVariant" v
      INNER JOIN "TechnologicalCard" t ON t."id" = v."technologicalCardId"
      WHERE v."catalogItemId" = ANY($1::int[])
      ORDER BY v."displayOrder" ASC, v."id" ASC
    `,
    [catalogItemIds],
  );

  return result.rows.reduce<Map<number, ReturnType<typeof mapRowToCatalogVariant>[]>>((acc, row) => {
    const current = acc.get(row.catalogItemId) ?? [];
    current.push(mapRowToCatalogVariant(row));
    acc.set(row.catalogItemId, current);
    return acc;
  }, new Map());
}

async function hydrateCatalogExcludedIngredients(rows: CatalogRow[]) {
  const catalogItemIds = rows.map((row) => row.id);

  if (!catalogItemIds.length) {
    return new Map<number, ReturnType<typeof mapRowToCatalogExcludedIngredient>[]>();
  }

  const result = await pool.query<CatalogExcludedIngredientRow>(
    `
      SELECT
        e."id",
        e."catalogItemId",
        e."productId",
        p."name" AS "productName",
        e."label",
        e."displayOrder"
      FROM "CatalogItemExcludedIngredient" e
      INNER JOIN "Product" p ON p."id" = e."productId"
      WHERE e."catalogItemId" = ANY($1::int[])
      ORDER BY e."displayOrder" ASC, e."id" ASC
    `,
    [catalogItemIds],
  );

  return result.rows.reduce<Map<number, ReturnType<typeof mapRowToCatalogExcludedIngredient>[]>>((acc, row) => {
    const current = acc.get(row.catalogItemId) ?? [];
    current.push(mapRowToCatalogExcludedIngredient(row));
    acc.set(row.catalogItemId, current);
    return acc;
  }, new Map());
}

function selectCatalogSql(where = "") {
  return `
      SELECT
        c."id",
        c."name",
        c."slug",
        c."category",
        c."kitchenZone",
        c."kitchenZones",
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
      ${where}
    `;
}

async function mapCatalogRows(rows: CatalogRow[], publishedOnly: boolean) {
  const [choiceSlotsByCard, variantsByItem, excludedIngredientsByItem] = await Promise.all([
    hydrateCatalogChoiceSlots(rows, publishedOnly),
    hydrateCatalogVariants(rows),
    hydrateCatalogExcludedIngredients(rows),
  ]);

  return rows.map((row) =>
    mapRowToCatalogItem(
      row,
      choiceSlotsByCard.get(row.technologicalCardId) ?? [],
      variantsByItem.get(row.id) ?? [],
      excludedIngredientsByItem.get(row.id) ?? [],
    ),
  );
}

export async function getCatalogItems(): Promise<CatalogItem[]> {
  const result = await pool.query<CatalogRow>(
    `
      ${selectCatalogSql()}
      ORDER BY c."category" ASC NULLS LAST, c."createdAt" DESC
    `,
  );

  return mapCatalogRows(result.rows, false);
}

export async function getPublicCatalogItems(): Promise<CatalogItem[]> {
  const result = await pool.query<CatalogRow>(
    `
      ${selectCatalogSql()}
      WHERE c."isPublished" = TRUE
      ORDER BY c."category" ASC NULLS LAST, c."createdAt" DESC
    `,
  );

  return mapCatalogRows(result.rows, true);
}

export async function getCatalogItemById(id: number): Promise<CatalogItem | null> {
  const result = await pool.query<CatalogRow>(
    `
      ${selectCatalogSql()}
      WHERE c."id" = $1
      LIMIT 1
    `,
    [id],
  );

  if (!result.rowCount) {
    return null;
  }

  return (await mapCatalogRows(result.rows, result.rows[0].isPublished))[0] ?? null;
}

export async function createCatalogItem(input: CatalogItemInput): Promise<CatalogItem> {
  await ensureCatalogTechCardExists(input);
  await ensureCatalogExcludedIngredientProductsExist(input);
  await ensureCatalogPriceListSlot(input);
  const slug = buildCatalogSlug(input);

  await ensureRecentDatabaseBackup("catalog-item-create");
  const catalogItemId = await withTransaction(async (client) => {
    const result = await client.query<{ id: number }>(
      `
        INSERT INTO "CatalogItem" (
          "name",
          "slug",
          "category",
          "kitchenZone",
          "kitchenZones",
          "description",
          "imageUrl",
          "priceCents",
          "isPublished",
          "technologicalCardId"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING "id"
      `,
      [
        input.name,
        slug,
        input.category,
        input.kitchenZone,
        input.kitchenZones,
        input.description,
        input.imageUrl,
        input.priceCents,
        input.priceListType === "CLIENT",
        input.technologicalCardId,
      ],
    );

    await replaceCatalogVariants(client, result.rows[0].id, input);
    await replaceCatalogExcludedIngredients(client, result.rows[0].id, input);

    return result.rows[0].id;
  });

  const item = await getCatalogItemById(catalogItemId);

  if (!item) {
    throw new Error("Catalog item was not found after create");
  }

  return item;
}

export async function updateCatalogItem(
  id: number,
  input: CatalogItemInput,
): Promise<CatalogItem | null> {
  await ensureCatalogTechCardExists(input);
  await ensureCatalogExcludedIngredientProductsExist(input);
  await ensureCatalogPriceListSlot(input, id);
  const slug = buildCatalogSlug(input);

  await ensureRecentDatabaseBackup("catalog-item-update");
  const updatedId = await withTransaction(async (client) => {
    const result = await client.query<{ id: number }>(
      `
        UPDATE "CatalogItem"
        SET
          "name" = $2,
          "slug" = $3,
          "category" = $4,
          "kitchenZone" = $5,
          "kitchenZones" = $6,
          "description" = $7,
          "imageUrl" = $8,
          "priceCents" = $9,
          "isPublished" = $10,
          "technologicalCardId" = $11
        WHERE "id" = $1
        RETURNING "id"
      `,
      [
        id,
        input.name,
        slug,
        input.category,
        input.kitchenZone,
        input.kitchenZones,
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

    await replaceCatalogVariants(client, id, input);
    await replaceCatalogExcludedIngredients(client, id, input);

    return id;
  });

  if (!updatedId) {
    return null;
  }

  return getCatalogItemById(updatedId);
}

async function replaceCatalogExcludedIngredients(
  client: PoolClient,
  catalogItemId: number,
  input: CatalogItemInput,
) {
  await client.query(`DELETE FROM "CatalogItemExcludedIngredient" WHERE "catalogItemId" = $1`, [catalogItemId]);

  for (const ingredient of input.excludedIngredients) {
    await client.query(
      `
        INSERT INTO "CatalogItemExcludedIngredient" (
          "catalogItemId",
          "productId",
          "label",
          "displayOrder"
        )
        VALUES ($1, $2, $3, $4)
      `,
      [
        catalogItemId,
        ingredient.productId,
        ingredient.label,
        ingredient.displayOrder,
      ],
    );
  }
}

async function replaceCatalogVariants(
  client: PoolClient,
  catalogItemId: number,
  input: CatalogItemInput,
) {
  await client.query(`DELETE FROM "CatalogItemVariant" WHERE "catalogItemId" = $1`, [catalogItemId]);

  for (const variant of input.variants) {
    await client.query(
      `
        INSERT INTO "CatalogItemVariant" (
          "catalogItemId",
          "technologicalCardId",
          "label",
          "priceCents",
          "isDefault",
          "displayOrder"
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        catalogItemId,
        variant.technologicalCardId,
        variant.label,
        variant.priceCents,
        variant.isDefault,
        variant.displayOrder,
      ],
    );
  }
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
