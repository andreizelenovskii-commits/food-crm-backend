import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), "../.env") });
config({ path: resolve(process.cwd(), ".env"), override: true });

type BackendEnv = {
  host: string;
  port: number;
  databaseUrl: string;
  sessionSecret: string;
  passwordPepper: string | null;
  sessionCookieName: string;
  clientSessionCookieName: string;
  sessionCookieDomain: string | null;
  sessionTtlDays: number;
  corsOrigins: string[];
  smsAeroEmail: string | null;
  smsAeroApiKey: string | null;
  smsAeroSign: string;
  smsAeroEnabled: boolean;
  publicOrderEmployeeId: number | null;
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
  const defaultOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://crm.crmandromeda.ru",
    "https://crmandromeda.ru",
    "https://www.crmandromeda.ru",
    "https://dev.crm.crmandromeda.ru",
  ];
  const configuredOrigins = (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return Array.from(new Set([...defaultOrigins, ...configuredOrigins]));
}

function parsePositiveInteger(value: string | null, fallback: number, name: string) {
  const parsed = Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function parseBoolean(value: string | null, fallback: boolean) {
  if (value === null) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parseOptionalPositiveInteger(value: string | null, name: string) {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function assertProductionSecret(name: string, value: string | null) {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  if (!value || value.length < 32) {
    throw new Error(`${name} must be set to at least 32 random characters in production`);
  }

  const normalized = value.toLowerCase().replace(/["']/g, "");
  const unsafeValues = new Set([
    "local-dev-session-secret-change-before-production",
    "build-time-placeholder-session-secret",
    "build-time-placeholder",
    "change-me",
  ]);

  if (unsafeValues.has(normalized)) {
    throw new Error(`${name} looks like a placeholder and must be replaced in production`);
  }
}

const sessionSecret = getOptionalEnv("BACKEND_SESSION_SECRET") ?? getRequiredEnv("SESSION_SECRET");
const passwordPepper = getOptionalEnv("PASSWORD_PEPPER");

assertProductionSecret("SESSION_SECRET/BACKEND_SESSION_SECRET", sessionSecret);
assertProductionSecret("PASSWORD_PEPPER", passwordPepper);

export const backendEnv: BackendEnv = {
  host: getOptionalEnv("HOST") ?? "0.0.0.0",
  port: parsePort(getOptionalEnv("PORT")),
  databaseUrl: getRequiredEnv("DATABASE_URL"),
  sessionSecret,
  passwordPepper,
  sessionCookieName: getOptionalEnv("BACKEND_SESSION_COOKIE_NAME") ?? "food_crm_api_session",
  clientSessionCookieName: getOptionalEnv("BACKEND_CLIENT_SESSION_COOKIE_NAME") ?? "food_crm_client_session",
  sessionCookieDomain: getOptionalEnv("BACKEND_SESSION_COOKIE_DOMAIN"),
  sessionTtlDays: parsePositiveInteger(getOptionalEnv("BACKEND_SESSION_TTL_DAYS"), 30, "BACKEND_SESSION_TTL_DAYS"),
  corsOrigins: parseCorsOrigins(getOptionalEnv("BACKEND_CORS_ORIGIN")),
  smsAeroEmail: getOptionalEnv("SMSAERO_EMAIL"),
  smsAeroApiKey: getOptionalEnv("SMSAERO_API_KEY"),
  smsAeroSign: getOptionalEnv("SMSAERO_SIGN") ?? "SMS Aero",
  smsAeroEnabled: parseBoolean(getOptionalEnv("SMSAERO_ENABLED"), true),
  publicOrderEmployeeId: parseOptionalPositiveInteger(
    getOptionalEnv("PUBLIC_ORDER_EMPLOYEE_ID"),
    "PUBLIC_ORDER_EMPLOYEE_ID",
  ),
};
