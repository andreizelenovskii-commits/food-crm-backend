import { withTransaction } from "@backend/shared/db/transaction";
import { ValidationError } from "@backend/shared/errors/app-error";

export async function deleteTechCard(id: number): Promise<boolean> {
  return withTransaction(async (client) => {
    const linkedCatalogItems = await client.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS "count"
        FROM "CatalogItem"
        WHERE "technologicalCardId" = $1
      `,
      [id],
    );

    if (Number(linkedCatalogItems.rows[0]?.count ?? 0) > 0) {
      throw new ValidationError("Техкарта привязана к каталогу. Сначала отвяжите её от прайсовых позиций.");
    }

    const existingCard = await client.query<{ id: number }>(
      `
        SELECT "id"
        FROM "TechnologicalCard"
        WHERE "id" = $1
        LIMIT 1
      `,
      [id],
    );

    if (!existingCard.rowCount) {
      return false;
    }

    await client.query(
      `
        DELETE FROM "TechCardIngredient"
        WHERE "technologicalCardId" = $1
      `,
      [id],
    );

    await client.query(
      `
        DELETE FROM "TechnologicalCard"
        WHERE "id" = $1
      `,
      [id],
    );

    return true;
  });
}
