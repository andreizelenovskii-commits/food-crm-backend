import { ValidationError } from "@backend/shared/errors/app-error";

const STOCK_EPSILON = 0.000001;

export type StockChangeContext = {
  productName?: string;
  productUnit?: string;
  requiredQuantity?: number;
  availableQuantity?: number;
};

export function assertNonNegativeStock(
  nextQuantity: number,
  context: StockChangeContext = {},
) {
  if (nextQuantity >= -STOCK_EPSILON) {
    return;
  }

  const availableQuantity = context.availableQuantity ?? 0;
  const requiredQuantity = context.requiredQuantity ?? Math.abs(nextQuantity);

  throw new ValidationError(
    buildInsufficientStockMessage({
      ...context,
      availableQuantity,
      requiredQuantity,
    }),
  );
}

export function assertStockCanDecrease(
  currentQuantity: number,
  decreaseQuantity: number,
  context: StockChangeContext = {},
) {
  assertNonNegativeStock(currentQuantity - decreaseQuantity, {
    ...context,
    availableQuantity: currentQuantity,
    requiredQuantity: decreaseQuantity,
  });
}

function buildInsufficientStockMessage(context: StockChangeContext) {
  const product = context.productName?.trim();
  const unit = context.productUnit?.trim() || "ед.";
  const required = formatQuantity(context.requiredQuantity ?? 0);
  const available = formatQuantity(context.availableQuantity ?? 0);

  if (product) {
    return `Недостаточно "${product}": нужно ${required} ${unit}, доступно ${available} ${unit}`;
  }

  return `Операция невозможна: остаток не может быть отрицательным. Нужно ${required} ${unit}, доступно ${available} ${unit}`;
}

function formatQuantity(value: number) {
  return value.toLocaleString("ru-RU", {
    maximumFractionDigits: 3,
  });
}
