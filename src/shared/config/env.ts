import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), "../.env") });
config({ path: resolve(process.cwd(), ".env"), override: true });

const envCache = new Map<string, string>();

export function getRequiredEnv(name: string): string {
  const cachedValue = envCache.get(name);

  if (cachedValue) {
    return cachedValue;
  }

  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  envCache.set(name, value);

  return value;
}

export function getOptionalEnv(name: string): string | null {
  const cachedValue = envCache.get(name);

  if (cachedValue) {
    return cachedValue;
  }

  const value = process.env[name]?.trim();

  if (!value) {
    return null;
  }

  envCache.set(name, value);

  return value;
}
