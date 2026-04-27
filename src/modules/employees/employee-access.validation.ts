import { assertStrongPassword } from "@backend/modules/auth/auth.password";
import { ValidationError } from "@backend/shared/errors/app-error";

function normalizeInput(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export type IssueEmployeeAccessInput = {
  email: string;
  password: string;
};

export function parseIssueEmployeeAccessInput(
  formData: FormData,
): IssueEmployeeAccessInput {
  const email = normalizeInput(formData.get("email")).toLowerCase();
  const password = normalizeInput(formData.get("password"));

  if (!email || !password) {
    throw new ValidationError("Заполните логин и пароль для сотрудника");
  }

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!isValidEmail) {
    throw new ValidationError("Введите корректный email для входа");
  }

  try {
    assertStrongPassword(password);
  } catch {
    throw new ValidationError(
      "Пароль должен быть не короче 12 символов и содержать строчные и заглавные буквы, цифру и спецсимвол",
    );
  }

  return {
    email,
    password,
  };
}
