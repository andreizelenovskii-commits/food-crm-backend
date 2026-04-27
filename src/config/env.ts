import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), "../.env") });
config({ path: resolve(process.cwd(), ".env"), override: true });

type BackendEnv = {
  host: string;
  port: number;
  databaseUrl: string;
  sessionSecret: string;
  sessionCookieName: string;
  sessionCookieDomain: string | null;
  corsOrigins: string[];
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getOptionalEnv(name: string) {
  return process.env[name]?.trim() || null;
}

function parsePort(value: string | null) {
  const port = Number(value ?? "4000");

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("PORT must be a positive integer");
  }

  return port;
}

function parseCorsOrigins(value: string | null) {
  return (value ?? "http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const backendEnv: BackendEnv = {
  host: getOptionalEnv("HOST") ?? "0.0.0.0",
  port: parsePort(getOptionalEnv("PORT")),
  databaseUrl: getRequiredEnv("DATABASE_URL"),
  sessionSecret: getOptionalEnv("BACKEND_SESSION_SECRET") ?? getRequiredEnv("SESSION_SECRET"),
  sessionCookieName: getOptionalEnv("BACKEND_SESSION_COOKIE_NAME") ?? "food_crm_api_session",
  sessionCookieDomain: getOptionalEnv("BACKEND_SESSION_COOKIE_DOMAIN"),
  corsOrigins: parseCorsOrigins(getOptionalEnv("BACKEND_CORS_ORIGIN")),
};
