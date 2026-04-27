import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "@backend/shared/db/pool";
import { getOptionalEnv } from "@backend/shared/config/env";

type DatabaseBackup = {
  meta: {
    createdAt: string;
    reason: string;
    tables: string[];
  };
  tables: Record<string, unknown[]>;
};

const DEFAULT_BACKUP_DIR = path.join(process.cwd(), "backups", "db");
const DEFAULT_MIN_INTERVAL_MINUTES = 15;

declare global {
  var __foodCrmBackupPromise: Promise<string | null> | undefined;
}

function isBackupEnabled() {
  return getOptionalEnv("DB_BACKUP_ENABLED") !== "0";
}

function getBackupDir() {
  return getOptionalEnv("DB_BACKUP_DIR") ?? DEFAULT_BACKUP_DIR;
}

function getMinIntervalMs() {
  const raw = Number(getOptionalEnv("DB_BACKUP_MIN_INTERVAL_MINUTES") ?? DEFAULT_MIN_INTERVAL_MINUTES);

  if (!Number.isFinite(raw) || raw < 0) {
    return DEFAULT_MIN_INTERVAL_MINUTES * 60_000;
  }

  return raw * 60_000;
}

function buildBackupFileName(reason: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const normalizedReason = reason
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "snapshot";

  return `${timestamp}__${normalizedReason}.json`;
}

async function listBackupFiles(dir: string) {
  try {
    const entries = await readdir(dir);
    return entries
      .filter((entry) => entry.endsWith(".json"))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export async function getLatestBackupPath() {
  const dir = getBackupDir();
  const files = await listBackupFiles(dir);
  return files[0] ? path.join(dir, files[0]) : null;
}

export async function readBackup(filePath: string): Promise<DatabaseBackup> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as DatabaseBackup;
}

export async function createDatabaseBackup(reason = "manual"): Promise<string | null> {
  if (!isBackupEnabled()) {
    return null;
  }

  const backupDir = getBackupDir();
  await mkdir(backupDir, { recursive: true });

  const tablesResult = await pool.query<{ table_name: string }>(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name ASC
    `,
  );

  const tableNames = tablesResult.rows.map((row) => row.table_name);
  const snapshot: DatabaseBackup = {
    meta: {
      createdAt: new Date().toISOString(),
      reason,
      tables: tableNames,
    },
    tables: {},
  };

  for (const tableName of tableNames) {
    const result = await pool.query(`SELECT * FROM "${tableName}"`);
    snapshot.tables[tableName] = result.rows;
  }

  const filePath = path.join(backupDir, buildBackupFileName(reason));
  await writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf8");
  return filePath;
}

export async function ensureRecentDatabaseBackup(reason = "auto-write"): Promise<string | null> {
  if (!isBackupEnabled()) {
    return null;
  }

  const existingPromise = globalThis.__foodCrmBackupPromise;

  if (existingPromise) {
    return existingPromise;
  }

  const run = (async () => {
    const latestBackupPath = await getLatestBackupPath();

    if (latestBackupPath) {
      const latestStats = await stat(latestBackupPath).catch(() => null);

      if (latestStats && Date.now() - latestStats.mtimeMs < getMinIntervalMs()) {
        return latestBackupPath;
      }
    }

    return createDatabaseBackup(reason);
  })();

  globalThis.__foodCrmBackupPromise = run;

  try {
    return await run;
  } finally {
    globalThis.__foodCrmBackupPromise = undefined;
  }
}
