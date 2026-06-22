export const BUSINESS_TIME_ZONE = process.env.BUSINESS_TIME_ZONE || "Asia/Sakhalin";
export const SHIFT_OPEN_HOUR = 9;
export const SHIFT_CLOSE_HOUR = 21;

export type Clock = {
  now(): Date;
};

export const systemClock: Clock = {
  now: () => new Date(),
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
