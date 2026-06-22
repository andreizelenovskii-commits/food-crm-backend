import { ValidationError } from "@backend/shared/errors/app-error";

export function parseShiftPersonName(value: unknown, fieldLabel: string) {
  const name = String(value ?? "").trim();

  if (name.length < 2) {
    throw new ValidationError(`${fieldLabel} должно быть заполнено`);
  }

  if (name.length > 80) {
    throw new ValidationError(`${fieldLabel} слишком длинное`);
  }

  return name;
}
