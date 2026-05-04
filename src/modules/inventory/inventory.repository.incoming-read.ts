import { pool } from "@backend/shared/db/pool";
import type { IncomingActSummary } from "@backend/modules/inventory/inventory.types";
import {
  getIncomingActItemsByActIds,
  mapIncomingAct,
} from "@backend/modules/inventory/inventory.repository.internals";
import type { IncomingActRow } from "@backend/modules/inventory/inventory.repository.rows";

export async function getIncomingActs(): Promise<IncomingActSummary[]> {
  const actsResult = await pool.query<IncomingActRow>(
    `
      SELECT
        a."id",
        a."responsibleEmployeeId",
        e."name" AS "responsibleEmployeeName",
        e."role" AS "responsibleEmployeeRole",
        a."supplierName",
        a."notes",
        a."createdAt",
        a."completedAt",
        COUNT(i."id") AS "itemsCount"
      FROM "IncomingAct" a
      INNER JOIN "Employee" e ON e."id" = a."responsibleEmployeeId"
      LEFT JOIN "IncomingActItem" i ON i."incomingActId" = a."id"
      GROUP BY
        a."id",
        a."responsibleEmployeeId",
        e."name",
        e."role",
        a."supplierName",
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
      return { rows: [] as IncomingActRow[] };
    }

    throw error;
  });

  const itemsByActId = await getIncomingActItemsByActIds(
    actsResult.rows.map((row) => row.id),
  );

  return actsResult.rows.map((row) => {
    const items = itemsByActId[row.id] ?? [];
    return mapIncomingAct(row, items);
  });
}

export async function getIncomingActById(
  actId: number,
): Promise<IncomingActSummary | null> {
  if (!Number.isInteger(actId) || actId <= 0) {
    return null;
  }

  const actResult = await pool.query<IncomingActRow>(
    `
      SELECT
        a."id",
        a."responsibleEmployeeId",
        e."name" AS "responsibleEmployeeName",
        e."role" AS "responsibleEmployeeRole",
        a."supplierName",
        a."notes",
        a."createdAt",
        a."completedAt",
        COUNT(i."id") AS "itemsCount"
      FROM "IncomingAct" a
      INNER JOIN "Employee" e ON e."id" = a."responsibleEmployeeId"
      LEFT JOIN "IncomingActItem" i ON i."incomingActId" = a."id"
      WHERE a."id" = $1
      GROUP BY
        a."id",
        a."responsibleEmployeeId",
        e."name",
        e."role",
        a."supplierName",
        a."notes",
        a."createdAt",
        a."completedAt"
      LIMIT 1
    `,
    [actId],
  );

  const act = actResult.rows[0];

  if (!act) {
    return null;
  }

  const itemsByActId = await getIncomingActItemsByActIds([act.id]);
  return mapIncomingAct(act, itemsByActId[act.id] ?? []);
}
