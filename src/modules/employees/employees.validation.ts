import { ValidationError } from "@backend/shared/errors/app-error";
import {
  hasCompleteRussianPhone,
  normalizeRussianPhoneForStorage,
} from "@backend/shared/lib/phone";
import {
  EMPLOYEE_ROLES,
  EMPLOYEE_ADJUSTMENT_TYPES,
  type EmployeeAdjustmentType,
  type EmployeeRole,
  type EmployeeSchedule,
  type EmployeeScheduleLegacy,
} from "@backend/modules/employees/employees.types";

function normalizeInput(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function isEmployeeRole(value: string): value is EmployeeRole {
  return EMPLOYEE_ROLES.includes(value as EmployeeRole);
}

function isEmployeeAdjustmentType(value: string): value is EmployeeAdjustmentType {
  return EMPLOYEE_ADJUSTMENT_TYPES.includes(value as EmployeeAdjustmentType);
}

function validateSchedule(schedule: unknown): EmployeeSchedule | EmployeeScheduleLegacy | null {
  if (!schedule) return null;

  if (typeof schedule !== "object" || Array.isArray(schedule) || schedule === null) {
    throw new ValidationError("Некорректный формат графика работы");
  }

  const scheduleObj = schedule as Record<string, unknown>;

  // Check if it's new format
  if ('shiftsPerDay' in scheduleObj && 'days' in scheduleObj) {
    const { shiftsPerDay, days } = scheduleObj;
    if (typeof shiftsPerDay !== 'number' || (shiftsPerDay !== 1 && shiftsPerDay !== 2)) {
      throw new ValidationError("Количество смен должно быть 1 или 2");
    }
    if (typeof days !== 'object' || Array.isArray(days) || days === null) {
      throw new ValidationError("Некорректный формат дней графика");
    }
    const daysObj = days as Record<string, unknown>;
    for (const [dateKey, daySchedule] of Object.entries(daysObj)) {
      if (typeof daySchedule !== 'object' || !daySchedule || !('shifts' in daySchedule)) {
        throw new ValidationError(`Некорректный формат дня ${dateKey}`);
      }
      const dayScheduleObj = daySchedule as Record<string, unknown>;
      const { shifts } = dayScheduleObj;
      if (!Array.isArray(shifts) || shifts.length !== shiftsPerDay) {
        throw new ValidationError(`Количество смен для дня ${dateKey} не соответствует настройкам`);
      }
      for (const shift of shifts) {
        const shiftObj = shift as Record<string, unknown>;
        if (typeof shift !== 'object' || !shift || typeof shiftObj.hours !== 'number' || shiftObj.hours < 0) {
          throw new ValidationError(`Некорректные часы смены для дня ${dateKey}`);
        }
      }
    }
    return schedule as EmployeeSchedule;
  }

  // Check if it's legacy format
  for (const [, hours] of Object.entries(scheduleObj)) {
    if (typeof hours !== "number" || hours < 0) {
      throw new ValidationError("Некорректный формат графика работы");
    }
  }
  return schedule as EmployeeScheduleLegacy;
}

export type CreateEmployeeInput = {
  name: string;
  role: EmployeeRole;
  phone: string | null;
  messenger: string | null;
  birthDate: string | null;
  hireDate: string | null;
};

export type UpdateEmployeeInput = {
  name?: string;
  role?: EmployeeRole;
  phone?: string | null;
  messenger?: string | null;
  schedule?: EmployeeSchedule | EmployeeScheduleLegacy | null;
  monthlyHours?: number | null;
  birthDate?: string | null;
  hireDate?: string | null;
};

export type CreateEmployeeAdjustmentInput = {
  employeeId: number;
  type: string;
  amountCents: number;
  comment: string | null;
  date: string;
};

export function parseCreateEmployeeInput(formData: FormData): CreateEmployeeInput {
  const name = normalizeInput(formData.get("name"));
  const role = normalizeInput(formData.get("role"));
  const phoneInput = normalizeInput(formData.get("phone"));
  const phone = normalizeRussianPhoneForStorage(phoneInput);
  const messenger = normalizeInput(formData.get("messenger"));
  const birthDateStr = normalizeInput(formData.get("birthDate"));
  const hireDateStr = normalizeInput(formData.get("hireDate"));

  if (!name || !role) {
    throw new ValidationError("Заполните имя и роль сотрудника");
  }

  if (!isEmployeeRole(role)) {
    throw new ValidationError("Выберите корректную роль сотрудника");
  }

  if (phone && !hasCompleteRussianPhone(phoneInput)) {
    throw new ValidationError("Введите корректный телефон в формате +7");
  }

  if (messenger) {
    try {
      new URL(messenger);
    } catch {
      throw new ValidationError("Введите корректную ссылку на мессенджер");
    }
  }

  let birthDate: string | null = null;
  if (birthDateStr) {
    const parsed = new Date(`${birthDateStr}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      throw new ValidationError("Введите корректную дату рождения");
    }
    birthDate = birthDateStr;
  }

  let hireDate: string | null = null;
  if (hireDateStr) {
    const parsed = new Date(`${hireDateStr}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      throw new ValidationError("Введите корректную дату приема на работу");
    }
    hireDate = hireDateStr;
  }

  return {
    name,
    role,
    phone: phone || null,
    messenger: messenger || null,
    birthDate,
    hireDate,
  };
}

export function parseUpdateEmployeeInput(formData: FormData): UpdateEmployeeInput {
  const name = normalizeInput(formData.get("name"));
  const role = normalizeInput(formData.get("role"));
  const phoneInput = normalizeInput(formData.get("phone"));
  const phone = normalizeRussianPhoneForStorage(phoneInput);
  const messenger = normalizeInput(formData.get("messenger"));
  const scheduleStr = normalizeInput(formData.get("schedule"));
  const monthlyHoursStr = normalizeInput(formData.get("monthlyHours"));
  const birthDateStr = normalizeInput(formData.get("birthDate"));
  const hireDateStr = normalizeInput(formData.get("hireDate"));

  const input: UpdateEmployeeInput = {};

  if (name) input.name = name;
  if (role) {
    if (!isEmployeeRole(role)) {
      throw new ValidationError("Выберите корректную роль сотрудника");
    }
    input.role = role;
  }
  if (phoneInput !== undefined) {
    if (phone && !hasCompleteRussianPhone(phoneInput)) {
      throw new ValidationError("Введите корректный телефон в формате +7");
    }
    input.phone = phone || null;
  }
  if (messenger !== undefined) {
    if (messenger) {
      try {
        new URL(messenger);
      } catch {
        throw new ValidationError("Введите корректную ссылку на мессенджер");
      }
    }
    input.messenger = messenger || null;
  }

  if (scheduleStr !== undefined) {
    let schedule: EmployeeSchedule | EmployeeScheduleLegacy | null = null;
    if (scheduleStr) {
      try {
        const parsed = JSON.parse(scheduleStr);
        schedule = validateSchedule(parsed);
      } catch (error) {
        if (error instanceof ValidationError) {
          throw error;
        }
        throw new ValidationError("Некорректный формат графика работы");
      }
    }
    input.schedule = schedule;
  }

  if (monthlyHoursStr !== undefined) {
    if (monthlyHoursStr) {
      const monthlyHours = Number(monthlyHoursStr);
      if (!Number.isFinite(monthlyHours) || monthlyHours < 0) {
        throw new ValidationError("Часы работы должны быть неотрицательным числом");
      }
      input.monthlyHours = monthlyHours;
    } else {
      input.monthlyHours = null;
    }
  }

  if (birthDateStr !== undefined) {
    if (birthDateStr) {
      const parsed = new Date(`${birthDateStr}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) {
        throw new ValidationError("Введите корректную дату рождения");
      }
      input.birthDate = birthDateStr;
    } else {
      input.birthDate = null;
    }
  }

  if (hireDateStr !== undefined) {
    if (hireDateStr) {
      const parsed = new Date(`${hireDateStr}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) {
        throw new ValidationError("Введите корректную дату приема на работу");
      }
      input.hireDate = hireDateStr;
    } else {
      input.hireDate = null;
    }
  }

  return input;
}

export function parseCreateEmployeeAdjustmentInput(formData: FormData): CreateEmployeeAdjustmentInput {
  const employeeId = Number(normalizeInput(formData.get("employeeId")));
  const type = normalizeInput(formData.get("type"));
  const amount = Number(normalizeInput(formData.get("amount")));
  const comment = normalizeInput(formData.get("comment"));
  const date = normalizeInput(formData.get("date"));

  if (!employeeId || !type || !amount || !date) {
    throw new ValidationError("Заполните тип, сумму, дату и сотрудника");
  }

  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    throw new ValidationError("Некорректный сотрудник");
  }

  if (!isEmployeeAdjustmentType(type)) {
    throw new ValidationError("Выберите корректный тип записи");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ValidationError("Сумма должна быть положительным числом");
  }

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new ValidationError("Введите корректную дату");
  }

  return {
    employeeId,
    type,
    amountCents: Math.round(amount * 100),
    comment: comment || null,
    date: parsedDate.toISOString(),
  };
}
