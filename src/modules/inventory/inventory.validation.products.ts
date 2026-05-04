import { ValidationError } from "@backend/shared/errors/app-error";
import {
  PRODUCT_CATEGORIES,
  type ProductCategory,
} from "@backend/modules/inventory/inventory.types";
import {
  assertNoDuplicateId,
  normalizeInput,
  parseDecimal,
  parsePriceToCents,
} from "@backend/modules/inventory/inventory.validation.shared";
import type {
  InventoryAuditEntryInput,
  ProductInput,
} from "@backend/modules/inventory/inventory.validation.types";

export function parseProductInput(formData: FormData): ProductInput {
  const name = normalizeInput(formData.get("name"));
  const category = normalizeInput(formData.get("category"));
  const unit = normalizeInput(formData.get("unit"));
  const stockQuantityRaw = normalizeInput(formData.get("stockQuantity"));
  const priceRaw = normalizeInput(formData.get("price"));
  const description = normalizeInput(formData.get("description"));

  if (!name || !category || !unit) {
    throw new ValidationError("Заполните название, категорию и единицу измерения");
  }

  if (!PRODUCT_CATEGORIES.includes(category as ProductCategory)) {
    throw new ValidationError("Выберите категорию товара из списка");
  }

  if (unit !== "кг" && unit !== "шт") {
    throw new ValidationError("Выберите единицу измерения: кг или шт");
  }

  const stockQuantity = parseDecimal(stockQuantityRaw || "0", "Остаток");

  if (stockQuantity < 0) {
    throw new ValidationError("Остаток должен быть неотрицательным числом");
  }

  return {
    name,
    category: category as ProductCategory,
    unit,
    stockQuantity,
    priceCents: parsePriceToCents(priceRaw),
    description: description || null,
  };
}

export function parseInventoryAuditInput(formData: FormData): InventoryAuditEntryInput[] {
  const productIds = formData
    .getAll("productId")
    .map((value) => Number(String(value ?? "").trim()));
  const actualQuantities = formData
    .getAll("actualQuantity")
    .map((value) => String(value ?? "").trim());

  if (
    productIds.length === 0 ||
    actualQuantities.length === 0 ||
    productIds.length !== actualQuantities.length
  ) {
    throw new ValidationError("Не удалось прочитать данные инвентаризации");
  }

  const uniqueProductIds = new Set<number>();
  const entries = productIds.flatMap((productId, index) => {
    const actualQuantityRaw = actualQuantities[index];

    if (!actualQuantityRaw) {
      return [];
    }

    if (!Number.isInteger(productId) || productId <= 0) {
      throw new ValidationError("В списке инвентаризации найден некорректный товар");
    }

    assertNoDuplicateId(
      uniqueProductIds,
      productId,
      "Один и тот же товар нельзя добавить в инвентаризацию дважды",
    );

    const actualQuantity = parseDecimal(actualQuantityRaw, "Фактический остаток");

    if (actualQuantity < 0) {
      throw new ValidationError("Фактический остаток должен быть неотрицательным числом");
    }

    return [{ productId, actualQuantity }];
  });

  if (entries.length === 0) {
    throw new ValidationError("Укажи фактический остаток хотя бы для одной позиции");
  }

  return entries;
}
