import { ValidationError } from "@backend/shared/errors/app-error";
import type { LoginInput } from "@backend/modules/auth/auth.types";

function normalizeInput(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export function parseLoginInput(formData: FormData): LoginInput {
  const email = normalizeInput(formData.get("email")).toLowerCase();
  const password = normalizeInput(formData.get("password"));

  if (!email || !password) {
    throw new ValidationError("Заполни email и пароль");
  }

  return { email, password };
}
