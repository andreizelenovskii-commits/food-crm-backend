import { ValidationError } from "@backend/shared/errors/app-error";
import {
  WRITEOFF_REASONS,
  type WriteoffReason,
} from "@backend/modules/inventory/inventory.types";
import {
  assertNoDuplicateId,
  assertPositiveInteger,
  normalizeInput,
  parseDecimal,
  parsePriceToCents,
} from "@backend/modules/inventory/inventory.validation.shared";
import type {
  CreateIncomingActInput,
  CreateWriteoffActInput,
} from "@backend/modules/inventory/inventory.validation.types";

export function parseCreateWriteoffActInput(formData: FormData): CreateWriteoffActInput {
  const responsibleEmployeeId = Number(normalizeInput(formData.get("responsibleEmployeeId")));
  const reason = normalizeInput(formData.get("reason"));
  const notes = normalizeInput(formData.get("notes"));
  const productIds = formData
    .getAll("productId")
    .map((value) => Number(String(value ?? "").trim()));
  const quantities = formData
    .getAll("quantity")
    .map((value) => normalizeInput(value));

  assertPositiveInteger(responsibleEmployeeId, "Выбери ответственного за списание");

  if (!WRITEOFF_REASONS.includes(reason as WriteoffReason)) {
    throw new ValidationError("Выбери корректную причину списания");
  }

  if (productIds.length === 0 || productIds.length !== quantities.length) {
    throw new ValidationError("Не удалось обработать строки акта списания");
  }

  const uniqueProductIds = new Set<number>();
  const items = productIds.flatMap((productId, index) => {
    const quantityRaw = quantities[index];

    if (!quantityRaw) {
      return [];
    }

    assertPositiveInteger(productId, "В акте списания найден некорректный товар");
    assertNoDuplicateId(
      uniqueProductIds,
      productId,
      "Один и тот же товар нельзя списывать дважды в одном акте",
    );

    const quantity = parseDecimal(quantityRaw, "Количество списания");

    if (quantity <= 0) {
      throw new ValidationError("Количество списания должно быть положительным числом");
    }

    return [{ productId, quantity }];
  });

  if (items.length === 0) {
    throw new ValidationError("Укажи количество хотя бы для одной позиции");
  }

  return {
    responsibleEmployeeId,
    reason: reason as WriteoffReason,
    notes: notes || null,
    items,
  };
}

export function parseCreateIncomingActInput(formData: FormData): CreateIncomingActInput {
  const responsibleEmployeeId = Number(normalizeInput(formData.get("responsibleEmployeeId")));
  const supplierName = normalizeInput(formData.get("supplierName"));
  const notes = normalizeInput(formData.get("notes"));
  const productIds = formData
    .getAll("productId")
    .map((value) => Number(String(value ?? "").trim()));
  const quantities = formData
    .getAll("quantity")
    .map((value) => normalizeInput(value));
  const prices = formData.getAll("price").map((value) => normalizeInput(value));

  assertPositiveInteger(responsibleEmployeeId, "Выбери ответственного за поступление");

  if (
    productIds.length === 0 ||
    productIds.length !== quantities.length ||
    productIds.length !== prices.length
  ) {
    throw new ValidationError("Не удалось обработать строки акта поступления");
  }

  const uniqueProductIds = new Set<number>();
  const items = productIds.flatMap((productId, index) => {
    const quantityRaw = quantities[index];
    const priceRaw = prices[index];

    if (!quantityRaw) {
      return [];
    }

    assertPositiveInteger(productId, "В акте поступления найден некорректный товар");
    assertNoDuplicateId(
      uniqueProductIds,
      productId,
      "Один и тот же товар нельзя добавить в поступление дважды",
    );

    const quantity = parseDecimal(quantityRaw, "Количество поступления");

    if (quantity <= 0) {
      throw new ValidationError("Количество поступления должно быть положительным числом");
    }

    const priceCents = parsePriceToCents(priceRaw);

    if (priceCents <= 0) {
      throw new ValidationError("Укажи положительную закупочную цену");
    }

    return [{ productId, quantity, priceCents }];
  });

  if (items.length === 0) {
    throw new ValidationError("Укажи количество хотя бы для одной позиции");
  }

  return {
    responsibleEmployeeId,
    supplierName: supplierName || null,
    notes: notes || null,
    items,
  };
}
