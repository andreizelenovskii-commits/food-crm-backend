import { ValidationError } from "@backend/shared/errors/app-error";

/** Цифры номера РФ: 7XXXXXXXXXX (11 цифр). */
export function normalizeRuPhoneDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) {
    return `7${digits.slice(1)}`;
  }
  if (digits.length === 10 && digits.startsWith("9")) {
    return `7${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("7")) {
    return digits;
  }
  return digits;
}

export function isValidRuMobileDigits(normalized: string): boolean {
  return /^7\d{10}$/.test(normalized);
}

export function parseLoginPhone(raw: string): string {
  const normalized = normalizeRuPhoneDigits(raw.trim());

  if (!isValidRuMobileDigits(normalized)) {
    throw new ValidationError("Введи номер телефона в формате +7 и ещё 10 цифр");
  }

  return normalized;
}
