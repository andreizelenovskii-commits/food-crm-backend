import { pool } from "@backend/shared/db/pool";
import type { WriteoffActSummary } from "@backend/modules/inventory/inventory.types";
import {
  getWriteoffActItemsByActIds,
  mapWriteoffAct,
} from "@backend/modules/inventory/inventory.repository.internals";
import type { WriteoffActRow } from "@backend/modules/inventory/inventory.repository.rows";

export async function getWriteoffActs(): Promise<WriteoffActSummary[]> {
  const actsResult = await pool.query<WriteoffActRow>(
    `
      SELECT
        a."id",
        a."responsibleEmployeeId",
        e."name" AS "responsibleEmployeeName",
        e."role" AS "responsibleEmployeeRole",
        a."reason",
        a."notes",
        a."createdAt",
        a."completedAt",
        COUNT(i."id") AS "itemsCount"
      FROM "WriteoffAct" a
      INNER JOIN "Employee" e ON e."id" = a."responsibleEmployeeId"
      LEFT JOIN "WriteoffActItem" i ON i."writeoffActId" = a."id"
      GROUP BY
        a."id",
        a."responsibleEmployeeId",
        e."name",
        e."role",
        a."reason",
        a."notes",
        a."createdAt",
        a."completedAt"
      ORDER BY a."createdAt" DESC, a."id" DESC
    `,
  ).catch((error: unknown) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "42P01"
    ) {
      return { rows: [] as WriteoffActRow[] };
    }

    throw error;
  });

  const itemsByActId = await getWriteoffActItemsByActIds(
    actsResult.rows.map((row) => row.id),
  );

  return actsResult.rows.map((row) => {
    const items = itemsByActId[row.id] ?? [];
    return mapWriteoffAct(row, items);
  });
}
