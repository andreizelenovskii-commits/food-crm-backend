import { ValidationError } from "@backend/shared/errors/app-error";
import type { ManagementAccountingEntryType } from "@backend/modules/management-accounting/management-accounting.types";

export type ManagementAccountingQuery = {
  date?: string;
};

export type ManagementAccountingManualEntryInput = {
  date: string;
  type: ManagementAccountingEntryType;
  category: string;
  amountCents: number;
  comment: string | null;
};

const ENTRY_TYPES = ["INCOME", "EXPENSE"] as const;

function parseDate(value: unknown, fieldLabel = "дата") {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError(`Некорректная ${fieldLabel} управленческого учета`);
  }

  return value;
}

function parseText(value: unknown, fieldLabel: string, maxLength: number) {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) {
    throw new ValidationError(`Заполните ${fieldLabel}`);
  }

  if (text.length > maxLength) {
    throw new ValidationError(`${fieldLabel} слишком длинное`);
  }

  return text;
}

function parseOptionalText(value: unknown, maxLength: number) {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) {
    return null;
  }

  if (text.length > maxLength) {
    throw new ValidationError("Комментарий слишком длинный");
  }

  return text;
}

function parseAmountCents(value: unknown) {
  const normalized = typeof value === "string"
    ? value.replace(",", ".").trim()
    : value;
  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ValidationError("Сумма должна быть больше нуля");
  }

  return Math.round(amount * 100);
}

export function parseManagementAccountingQuery(query: unknown): ManagementAccountingQuery {
  const source = query && typeof query === "object"
    ? query as Record<string, unknown>
    : {};
  const date = typeof source.date === "string" ? source.date : undefined;

  if (date) {
    parseDate(date);
  }

  return { date };
}

export function parseManagementAccountingManualEntryInput(
  payload: unknown,
): ManagementAccountingManualEntryInput {
  const source = payload && typeof payload === "object"
    ? payload as Record<string, unknown>
    : {};
  const type = source.type;

  if (typeof type !== "string" || !ENTRY_TYPES.includes(type as ManagementAccountingEntryType)) {
    throw new ValidationError("Некорректный тип статьи управленческого учета");
  }

  return {
    date: parseDate(source.date),
    type: type as ManagementAccountingEntryType,
    category: parseText(source.category, "статью", 80),
    amountCents: parseAmountCents(source.amount ?? source.amountCents),
    comment: parseOptionalText(source.comment, 300),
  };
}
