import { ValidationError } from "@backend/shared/errors/app-error";

export type ManagementAccountingQuery = {
  date?: string;
};

export function parseManagementAccountingQuery(query: unknown): ManagementAccountingQuery {
  const source = query && typeof query === "object"
    ? query as Record<string, unknown>
    : {};
  const date = typeof source.date === "string" ? source.date : undefined;

  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ValidationError("Некорректная дата управленческого учета");
  }

  return { date };
}
