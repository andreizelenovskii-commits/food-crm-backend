import { pool } from "@backend/shared/db/pool";
import { ensureRecentDatabaseBackup } from "@backend/shared/db/backup";
import type { CatalogItemInput } from "@backend/modules/catalog/catalog.validation";
import type { CatalogItem } from "@backend/modules/catalog/catalog.types";
import {
  buildCatalogSlug,
  ensureCatalogPriceListSlot,
  ensureCatalogTechCardMatches,
  mapRowToCatalogItem,
  type CatalogRow,
} from "@backend/modules/catalog/catalog.repository.shared";

export async function getCatalogItems(): Promise<CatalogItem[]> {
  const result = await pool.query<CatalogRow>(
    `
      SELECT
        c."id",
        c."name",
        c."slug",
        c."category",
        t."pizzaSize",
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

  return result.rows.map(mapRowToCatalogItem);
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

  return mapRowToCatalogItem(result.rows[0]);
}

export async function createCatalogItem(input: CatalogItemInput): Promise<CatalogItem> {
  await ensureCatalogTechCardMatches(input);
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
  await ensureCatalogTechCardMatches(input);
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
