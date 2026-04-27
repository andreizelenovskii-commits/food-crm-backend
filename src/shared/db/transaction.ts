import type { PoolClient } from "pg";
import { ensureRecentDatabaseBackup } from "@backend/shared/db/backup";
import { pool } from "@backend/shared/db/pool";

export async function withTransaction<T>(
  run: (client: PoolClient) => Promise<T>,
): Promise<T> {
  await ensureRecentDatabaseBackup("transaction-write");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback errors when the connection is already broken
    }

    throw error;
  } finally {
    client.release();
  }
}
