import { ValidationError } from "@backend/shared/errors/app-error";
import {
  assertNoDuplicateId,
  normalizeInput,
  parseDecimal,
} from "@backend/modules/inventory/inventory.validation.shared";
import type {
  CreateInventorySessionInput,
  InventorySessionActualInput,
} from "@backend/modules/inventory/inventory.validation.types";

export function parseCreateInventorySessionInput(
  formData: FormData,
): CreateInventorySessionInput {
  const responsibleEmployeeId = Number(normalizeInput(formData.get("responsibleEmployeeId")));
  const notes = normalizeInput(formData.get("notes"));
  const productIds = formData
    .getAll("productId")
    .map((value) => Number(String(value ?? "").trim()))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (!Number.isInteger(responsibleEmployeeId) || responsibleEmployeeId <= 0) {
    throw new ValidationError("Выбери ответственного за инвентаризацию");
  }

  if (productIds.length === 0) {
    throw new ValidationError("Добавь хотя бы один товар в лист инвентаризации");
  }

  const uniqueProductIds = new Set<number>();

  for (const productId of productIds) {
    assertNoDuplicateId(
      uniqueProductIds,
      productId,
      "Один и тот же товар нельзя добавить в лист дважды",
    );
  }

  return {
    responsibleEmployeeId,
    notes: notes || null,
    productIds,
  };
}

export function parseInventorySessionActualsInput(
  formData: FormData,
): InventorySessionActualInput[] {
  const itemIds = formData
    .getAll("itemId")
    .map((value) => Number(String(value ?? "").trim()));
  const actualQuantities = formData
    .getAll("actualQuantity")
    .map((value) => normalizeInput(value));

  if (itemIds.length === 0 || itemIds.length !== actualQuantities.length) {
    throw new ValidationError("Не удалось обработать строки действующей инвентаризации");
  }

  const uniqueItemIds = new Set<number>();

  return itemIds.map((itemId, index) => {
    const actualQuantityRaw = actualQuantities[index];

    if (!Number.isInteger(itemId) || itemId <= 0) {
      throw new ValidationError("В инвентаризации найдена некорректная строка");
    }

    assertNoDuplicateId(uniqueItemIds, itemId, "Строки инвентаризации не должны повторяться");

    if (!actualQuantityRaw) {
      return {
        itemId,
        actualQuantity: null,
      };
    }

    const actualQuantity = parseDecimal(actualQuantityRaw, "Фактический остаток");

    if (actualQuantity < 0) {
      throw new ValidationError("Фактический остаток должен быть неотрицательным числом");
    }

    return {
      itemId,
      actualQuantity,
    };
  });
}
