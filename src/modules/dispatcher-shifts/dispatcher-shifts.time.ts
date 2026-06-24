import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const BUSINESS_TIME_ZONE = process.env.BUSINESS_TIME_ZONE || "Asia/Sakhalin";
export const SHIFT_OPEN_HOUR = 9;
export const SHIFT_CLOSE_HOUR = 21;
export const LOCAL_DEV_CLOCK_FILE = ".local-dev-clock.json";

export type Clock = {
  now(): Date;
};

export const systemClock: Clock = {
  now: () => getLocalDevClockOverrideNow() ?? new Date(),
};

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getZonedParts(value: Date, timeZone = BUSINESS_TIME_ZONE): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function zonedDateTimeToUtc(parts: Omit<ZonedParts, "minute" | "second"> & {
  minute?: number;
  second?: number;
}, timeZone = BUSINESS_TIME_ZONE) {
  const utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute ?? 0,
    parts.second ?? 0,
  );
  const zonedGuess = getZonedParts(new Date(utcGuess), timeZone);
  const zonedGuessAsUtc = Date.UTC(
    zonedGuess.year,
    zonedGuess.month - 1,
    zonedGuess.day,
    zonedGuess.hour,
    zonedGuess.minute,
    zonedGuess.second,
  );
  const offsetMs = zonedGuessAsUtc - utcGuess;

  return new Date(utcGuess - offsetMs);
}

export function parseBusinessDateTime(value: string, timeZone = BUSINESS_TIME_ZONE) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);

  if (!match) {
    throw new Error("Use format YYYY-MM-DD HH:mm");
  }

  const [, year, month, day, hour, minute, second = "00"] = match;
  const parts = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };

  if (
    parts.month < 1 ||
    parts.month > 12 ||
    parts.day < 1 ||
    parts.day > 31 ||
    parts.hour < 0 ||
    parts.hour > 23 ||
    parts.minute < 0 ||
    parts.minute > 59 ||
    parts.second < 0 ||
    parts.second > 59
  ) {
    throw new Error("Invalid local business date/time");
  }

  return zonedDateTimeToUtc(parts, timeZone);
}

export function isLocalDevClockOverrideAllowed(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV === "development" && env.LOCAL_DEV_TOOLS_ENABLED === "true";
}

export function getLocalDevClockOverridePath(cwd = process.cwd()) {
  return resolve(cwd, LOCAL_DEV_CLOCK_FILE);
}

export function getLocalDevClockOverrideNow(input: {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  path?: string;
} = {}) {
  const env = input.env ?? process.env;

  if (!isLocalDevClockOverrideAllowed(env)) {
    return null;
  }

  const filePath = input.path ?? getLocalDevClockOverridePath(input.cwd);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const payload = JSON.parse(readFileSync(filePath, "utf8")) as { now?: unknown };

    if (typeof payload.now !== "string") {
      return null;
    }

    const parsed = new Date(payload.now);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

export function getBusinessDateParts(now: Date, timeZone = BUSINESS_TIME_ZONE) {
  const parts = getZonedParts(now, timeZone);

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
  };
}

export function getBusinessDate(now: Date, timeZone = BUSINESS_TIME_ZONE) {
  const { year, month, day } = getBusinessDateParts(now, timeZone);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getBusinessDayStart(now: Date, timeZone = BUSINESS_TIME_ZONE) {
  return getBusinessDateUtc(getBusinessDate(now, timeZone), timeZone);
}

export function getBusinessDateUtc(businessDate: string, timeZone = BUSINESS_TIME_ZONE) {
  const [year, month, day] = businessDate.split("-").map(Number);

  return zonedDateTimeToUtc({ year, month, day, hour: 0 }, timeZone);
}

export function getOpenThreshold(now: Date, timeZone = BUSINESS_TIME_ZONE) {
  const { year, month, day } = getBusinessDateParts(now, timeZone);

  return zonedDateTimeToUtc({ year, month, day, hour: SHIFT_OPEN_HOUR }, timeZone);
}

export function getCloseThreshold(businessDate: string, timeZone = BUSINESS_TIME_ZONE) {
  const [year, month, day] = businessDate.split("-").map(Number);

  return zonedDateTimeToUtc({ year, month, day, hour: SHIFT_CLOSE_HOUR }, timeZone);
}

export function toBusinessDate(value: Date, timeZone = BUSINESS_TIME_ZONE) {
  return getBusinessDate(value, timeZone);
}

export function formatShiftNumber(number: number) {
  return String(number).padStart(3, "0");
}
