import type { FastifyRequest } from "fastify";
import { ValidationError } from "@backend/shared/errors/app-error";

type RequestBody = Record<string, unknown>;

export function getRequestBody(request: FastifyRequest): RequestBody {
  if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
    return {};
  }

  return request.body as RequestBody;
}

export function getNumericParam(request: FastifyRequest, name: string) {
  const value = Number((request.params as Record<string, string | undefined>)[name]);

  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError("Некорректный идентификатор");
  }

  return value;
}

export function getStringBodyField(body: RequestBody, name: string) {
  const value = body[name];
  return typeof value === "string" ? value.trim() : "";
}

export function toFormData(body: RequestBody, fields: string[]) {
  const formData = new FormData();

  for (const field of fields) {
    const value = body[field];

    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value === "object") {
      formData.append(field, JSON.stringify(value));
      continue;
    }

    formData.append(field, String(value));
  }

  return formData;
}

export function appendItems(
  formData: FormData,
  items: unknown,
  fieldMap: Record<string, string>,
) {
  if (!Array.isArray(items)) {
    return;
  }

  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const record = item as Record<string, unknown>;

    for (const [sourceField, targetField] of Object.entries(fieldMap)) {
      const value = record[sourceField];

      if (value !== undefined && value !== null) {
        formData.append(targetField, String(value));
      }
    }
  }
}
