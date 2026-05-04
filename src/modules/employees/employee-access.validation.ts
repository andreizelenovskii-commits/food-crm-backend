import { assertStrongPassword } from "@backend/modules/auth/auth.password";
import { ValidationError } from "@backend/shared/errors/app-error";
import { parseLoginPhone } from "@backend/lib/phone";

function normalizeInput(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export type IssueEmployeeAccessInput = {
  phone: string;
  password: string;
};

export function parseIssueEmployeeAccessInput(formData: FormData): IssueEmployeeAccessInput {
  const phoneRaw = normalizeInput(formData.get("phone")) || normalizeInput(formData.get("email"));
  const password = normalizeInput(formData.get("password"));

  if (!phoneRaw || !password) {
    throw new ValidationError("Заполните номер телефона и пароль для сотрудника");
  }

  const phone = parseLoginPhone(phoneRaw);

  try {
    assertStrongPassword(password);
  } catch {
    throw new ValidationError(
      "Пароль должен быть не короче 12 символов и содержать строчные и заглавные буквы, цифру и спецсимвол",
    );
  }

  return {
    phone,
    password,
  };
}
