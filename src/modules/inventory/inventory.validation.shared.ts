import { ValidationError } from "@backend/shared/errors/app-error";

export function normalizeInput(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export function parseDecimal(value: string, fieldLabel: string) {
  const normalized = value.replace(",", ".");
  const amount = Number(normalized);

  if (!Number.isFinite(amount)) {
    throw new ValidationError(`${fieldLabel} должно быть числом`);
  }

  return amount;
}

export function parsePriceToCents(value: string) {
  if (!value) {
    return 0;
  }

  const normalized = value.replace(",", ".");
  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new ValidationError("Цена должна быть неотрицательным числом");
  }

  return Math.round(amount * 100);
}

export function assertPositiveInteger(value: number, message: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(message);
  }
}

export function assertNoDuplicateId(ids: Set<number>, id: number, message: string) {
  if (ids.has(id)) {
    throw new ValidationError(message);
  }

  ids.add(id);
}
