import type {
  DaySchedule,
  EmployeeSchedule,
  EmployeeScheduleLegacy,
} from "@backend/modules/employees/employees.types";

const LEGACY_WEEKDAY_TO_INDEX: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 0,
};

export const CALENDAR_WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;
export const MIN_SCHEDULE_HOURS = 1;
export const MAX_SCHEDULE_HOURS = 14;
const DEFAULT_SCHEDULE_HOURS = 8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidDaySchedule(value: unknown): value is DaySchedule {
  if (!isRecord(value) || !Array.isArray(value.shifts)) {
    return false;
  }

  return value.shifts.every((shift) => {
    return isRecord(shift) && typeof shift.hours === "number" && Number.isFinite(shift.hours);
  });
}

function isEmployeeSchedule(
  schedule: unknown,
): schedule is EmployeeSchedule {
  return (
    isRecord(schedule) &&
    (schedule.shiftsPerDay === 1 || schedule.shiftsPerDay === 2) &&
    isRecord(schedule.days) &&
    Object.values(schedule.days).every((day) => isValidDaySchedule(day))
  );
}

export function clampScheduleHours(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_SCHEDULE_HOURS;
  }

  return Math.min(MAX_SCHEDULE_HOURS, Math.max(MIN_SCHEDULE_HOURS, Math.round(value)));
}

function normalizeDaySchedule(day: DaySchedule): DaySchedule {
  const totalHours = day.shifts.reduce((sum, shift) => sum + shift.hours, 0);

  return {
    shifts: [{ hours: clampScheduleHours(totalHours) }],
  };
}

function cloneDaySchedule(day: DaySchedule): DaySchedule {
  return {
    shifts: day.shifts.map((shift) => ({ hours: shift.hours })),
  };
}

export function cloneEmployeeSchedule(schedule: EmployeeSchedule): EmployeeSchedule {
  return {
    shiftsPerDay: 1,
    days: Object.fromEntries(
      Object.entries(schedule.days).map(([dateKey, day]) => [dateKey, normalizeDaySchedule(cloneDaySchedule(day))]),
    ),
  };
}

export function formatScheduleDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseScheduleDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function getMonthDays(currentMonth: Date) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, index) => new Date(year, month, index + 1));
}

export function getCalendarGridDays(currentMonth: Date) {
  const monthDays = getMonthDays(currentMonth);
  const leadingEmptyDays = (monthDays[0]?.getDay() ?? 1) === 0
    ? 6
    : (monthDays[0]?.getDay() ?? 1) - 1;

  const grid: Array<Date | null> = [
    ...Array.from({ length: leadingEmptyDays }, () => null),
    ...monthDays,
  ];

  const trailingEmptyDays = (7 - (grid.length % 7 || 7)) % 7;
  return [
    ...grid,
    ...Array.from({ length: trailingEmptyDays }, () => null),
  ];
}

export function createDaySchedule(hours = DEFAULT_SCHEDULE_HOURS): DaySchedule {
  return {
    shifts: [{ hours: clampScheduleHours(hours) }],
  };
}

export function normalizeEmployeeSchedule(
  schedule: EmployeeSchedule | EmployeeScheduleLegacy | null | unknown,
  referenceDate = new Date(),
): EmployeeSchedule {
  if (!isRecord(schedule)) {
    return { shiftsPerDay: 1, days: {} };
  }

  if (isEmployeeSchedule(schedule)) {
    return cloneEmployeeSchedule(schedule);
  }

  const legacyEntries: Array<[string, number]> = Object.entries(schedule).flatMap(
    ([dayName, hours]) => {
      if (typeof hours === "number" && Number.isFinite(hours) && hours > 0) {
        return [[dayName, hours]];
      }

      return [];
    },
  );

  if (!legacyEntries.length) {
    return { shiftsPerDay: 1, days: {} };
  }

  const days: Record<string, DaySchedule> = {};

  for (const date of getMonthDays(referenceDate)) {
    const matchedEntry = legacyEntries.find(([dayName]) => {
      return LEGACY_WEEKDAY_TO_INDEX[dayName.toLowerCase()] === date.getDay();
    });

    if (!matchedEntry) {
      continue;
    }

    days[formatScheduleDateKey(date)] = createDaySchedule(matchedEntry[1]);
  }

  return {
    shiftsPerDay: 1,
    days,
  };
}

export function getScheduleStats(schedule: EmployeeSchedule | EmployeeScheduleLegacy | null) {
  const normalized = normalizeEmployeeSchedule(schedule);
  const totalDays = Object.keys(normalized.days).length;
  const totalHours = Object.values(normalized.days).reduce((sum, day) => {
    return sum + day.shifts.reduce((daySum, shift) => daySum + shift.hours, 0);
  }, 0);

  return {
    totalDays,
    totalHours,
  };
}

export function formatHours(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatScheduleSummary(schedule: EmployeeSchedule | EmployeeScheduleLegacy | null) {
  const { totalDays, totalHours } = getScheduleStats(schedule);

  if (!totalDays) {
    return "График не задан";
  }

  const dayWord =
    totalDays % 10 === 1 && totalDays % 100 !== 11
      ? "день"
      : totalDays % 10 >= 2 && totalDays % 10 <= 4 && (totalDays % 100 < 10 || totalDays % 100 >= 20)
        ? "дня"
        : "дней";

  return `${totalDays} ${dayWord} • ${formatHours(totalHours)} ч`;
}
