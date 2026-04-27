import { Pool } from "pg";
import { getRequiredEnv } from "../config/env";

declare global {
  var __foodCrmPool: Pool | undefined;
}

function createPool() {
  return new Pool({
    connectionString: getRequiredEnv("DATABASE_URL"),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    maxLifetimeSeconds: 60,
  });
}

export const pool = globalThis.__foodCrmPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalThis.__foodCrmPool = pool;
}
