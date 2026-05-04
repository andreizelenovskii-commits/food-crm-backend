import { ValidationError } from "@backend/shared/errors/app-error";

export function mapProductConflict(error: unknown): never {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  ) {
    throw new ValidationError("Товар с таким названием уже существует");
  }

  throw error;
}

export function mapMissingWriteoffTables(error: unknown): never {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "42P01"
  ) {
    throw new ValidationError(
      "Модуль списаний ещё не инициализирован в базе данных. Примените миграции для склада.",
    );
  }

  throw error;
}
