import { ValidationError } from "@backend/shared/errors/app-error";
import type { LoginInput } from "@backend/modules/auth/auth.types";
import { parseLoginPhone } from "@backend/lib/phone";

function normalizeInput(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export function parseLoginInput(formData: FormData): LoginInput {
  const raw = normalizeInput(formData.get("phone")) || normalizeInput(formData.get("email"));
  const password = normalizeInput(formData.get("password"));

  if (!raw || !password) {
    throw new ValidationError("Заполни телефон и пароль");
  }

  let login: string;
  try {
    login = parseLoginPhone(raw);
  } catch {
    const legacy = raw.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(legacy)) {
      throw new ValidationError("Введи номер телефона в формате +7 и ещё 10 цифр");
    }
    login = legacy;
  }

  return { login, password };
}
