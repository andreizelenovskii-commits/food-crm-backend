import { ValidationError } from "@backend/shared/errors/app-error";
import {
  PRODUCT_CATEGORIES,
  WRITEOFF_REASONS,
  type ProductCategory,
  type WriteoffReason,
} from "@backend/modules/inventory/inventory.types";

function normalizeInput(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function parseDecimal(value: string, fieldLabel: string) {
  const normalized = value.replace(",", ".");
  const amount = Number(normalized);

  if (!Number.isFinite(amount)) {
    throw new ValidationError(`${fieldLabel} должно быть числом`);
  }

  return amount;
}

export type ProductInput = {
  name: string;
  category: ProductCategory;
  unit: "кг" | "шт";
  stockQuantity: number;
  priceCents: number;
  description: string | null;
};

export type InventoryAuditEntryInput = {
  productId: number;
  actualQuantity: number;
};

export type CreateInventorySessionInput = {
  responsibleEmployeeId: number;
  notes: string | null;
  productIds: number[];
};

export type InventorySessionActualInput = {
  itemId: number;
  actualQuantity: number | null;
};

export type CreateWriteoffActInput = {
  responsibleEmployeeId: number;
  reason: WriteoffReason;
  notes: string | null;
  items: Array<{
    productId: number;
    quantity: number;
  }>;
};

export type CreateIncomingActInput = {
  responsibleEmployeeId: number;
  supplierName: string | null;
  notes: string | null;
  items: Array<{
    productId: number;
    quantity: number;
    priceCents: number;
  }>;
};

function parsePriceToCents(value: string) {
  if (!value) {
    return 0;
  }

  const normalized = value.replace(",", ".");
  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new ValidationError("Цена должна быть неотрицательным числом");
  }

  return Math.round(amount * 100);
}

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

  if (productIds.length === 0 || actualQuantities.length === 0 || productIds.length !== actualQuantities.length) {
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

    if (uniqueProductIds.has(productId)) {
      throw new ValidationError("Один и тот же товар нельзя добавить в инвентаризацию дважды");
    }

    const actualQuantity = parseDecimal(actualQuantityRaw, "Фактический остаток");

    if (actualQuantity < 0) {
      throw new ValidationError("Фактический остаток должен быть неотрицательным числом");
    }

    uniqueProductIds.add(productId);

    return [{ productId, actualQuantity }];
  });

  if (entries.length === 0) {
    throw new ValidationError("Укажи фактический остаток хотя бы для одной позиции");
  }

  return entries;
}

export function parseCreateInventorySessionInput(formData: FormData): CreateInventorySessionInput {
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
    if (uniqueProductIds.has(productId)) {
      throw new ValidationError("Один и тот же товар нельзя добавить в лист дважды");
    }

    uniqueProductIds.add(productId);
  }

  return {
    responsibleEmployeeId,
    notes: notes || null,
    productIds,
  };
}

export function parseInventorySessionActualsInput(formData: FormData): InventorySessionActualInput[] {
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

    if (uniqueItemIds.has(itemId)) {
      throw new ValidationError("Строки инвентаризации не должны повторяться");
    }

    uniqueItemIds.add(itemId);

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

  if (!Number.isInteger(responsibleEmployeeId) || responsibleEmployeeId <= 0) {
    throw new ValidationError("Выбери ответственного за списание");
  }

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

    if (!Number.isInteger(productId) || productId <= 0) {
      throw new ValidationError("В акте списания найден некорректный товар");
    }

    if (uniqueProductIds.has(productId)) {
      throw new ValidationError("Один и тот же товар нельзя списывать дважды в одном акте");
    }

    const quantity = parseDecimal(quantityRaw, "Количество списания");

    if (quantity <= 0) {
      throw new ValidationError("Количество списания должно быть положительным числом");
    }

    uniqueProductIds.add(productId);

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
  const prices = formData
    .getAll("price")
    .map((value) => normalizeInput(value));

  if (!Number.isInteger(responsibleEmployeeId) || responsibleEmployeeId <= 0) {
    throw new ValidationError("Выбери ответственного за поступление");
  }

  if (productIds.length === 0 || productIds.length !== quantities.length || productIds.length !== prices.length) {
    throw new ValidationError("Не удалось обработать строки акта поступления");
  }

  const uniqueProductIds = new Set<number>();
  const items = productIds.flatMap((productId, index) => {
    const quantityRaw = quantities[index];
    const priceRaw = prices[index];

    if (!quantityRaw) {
      return [];
    }

    if (!Number.isInteger(productId) || productId <= 0) {
      throw new ValidationError("В акте поступления найден некорректный товар");
    }

    if (uniqueProductIds.has(productId)) {
      throw new ValidationError("Один и тот же товар нельзя добавить в поступление дважды");
    }

    const quantity = parseDecimal(quantityRaw, "Количество поступления");

    if (quantity <= 0) {
      throw new ValidationError("Количество поступления должно быть положительным числом");
    }

    const priceCents = parsePriceToCents(priceRaw);

    if (priceCents <= 0) {
      throw new ValidationError("Укажи положительную закупочную цену");
    }

    uniqueProductIds.add(productId);

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
