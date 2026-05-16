import { ValidationError } from "@backend/shared/errors/app-error";
import {
  type OrderDraftItem,
  ORDER_STATUSES,
  type OrderSource,
  type OrderCreateInput,
  type OrderStatus,
} from "@backend/modules/orders/orders.types";

const ORDER_SOURCES = ["ADMIN", "PHONE"] as const;

function normalizeInput(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export type OrderFormValues = {
  clientId: string;
  employeeId: string;
  status: string;
  source: string;
  deliveryFeeCents: string;
  isInternal: boolean;
  items: string;
};

export function getOrderFormValues(formData: FormData): OrderFormValues {
  const read = (name: string) => normalizeInput(formData.get(name));

  return {
    clientId: read("clientId"),
    employeeId: read("employeeId"),
    status: read("status"),
    source: read("source"),
    deliveryFeeCents: read("deliveryFeeCents"),
    isInternal: read("isInternal") === "true",
    items: read("items"),
  };
}

export function parseCreateOrderInput(formData: FormData): OrderCreateInput {
  const clientId = Number(normalizeInput(formData.get("clientId")));
  const employeeId = Number(normalizeInput(formData.get("employeeId")));
  const status = normalizeInput(formData.get("status"));
  const source = normalizeInput(formData.get("source")) || "ADMIN";
  const deliveryFeeCents = Number(normalizeInput(formData.get("deliveryFeeCents")));
  const isInternal = normalizeInput(formData.get("isInternal")) === "true";
  const itemsRaw = normalizeInput(formData.get("items"));

  if (!Number.isInteger(clientId) || clientId <= 0) {
    throw new ValidationError("Выбери клиента для заказа");
  }

  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    throw new ValidationError("Выбери сотрудника, который ведёт заказ");
  }

  if (!ORDER_STATUSES.includes(status as OrderStatus)) {
    throw new ValidationError("Выбери корректный статус заказа");
  }

  if (!ORDER_SOURCES.includes(source as (typeof ORDER_SOURCES)[number])) {
    throw new ValidationError("Выбери корректный источник заказа");
  }

  if (!Number.isInteger(deliveryFeeCents) || deliveryFeeCents < 0) {
    throw new ValidationError("Укажи корректную стоимость доставки");
  }

  let items: OrderDraftItem[] = [];

  try {
    const parsed = JSON.parse(itemsRaw) as Array<{ catalogItemId: number; quantity: number }>;
    items = parsed
      .filter((item) => Number.isInteger(item.catalogItemId) && Number.isInteger(item.quantity))
      .map((item) => ({
        catalogItemId: item.catalogItemId,
        quantity: item.quantity,
      }));
  } catch {
    throw new ValidationError("Не удалось прочитать состав заказа");
  }

  if (!items.length) {
    throw new ValidationError("Добавь хотя бы одну позицию в заказ");
  }

  if (items.some((item) => item.quantity <= 0)) {
    throw new ValidationError("Количество по позициям должно быть больше нуля");
  }

  return {
    clientId,
    employeeId,
    isInternal,
    status: status as OrderStatus,
    source: source as OrderSource,
    deliveryFeeCents,
    items,
  };
}
