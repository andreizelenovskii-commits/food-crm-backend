import { backendEnv } from "@backend/config/env";
import { pool } from "@backend/shared/db/pool";
import { ValidationError } from "@backend/shared/errors/app-error";
import { findPublicClientByPhone } from "@backend/modules/public-auth/public-auth.service";
import { createOrder } from "@backend/modules/orders/orders.repository";
import { updateClient } from "@backend/modules/clients/clients.repository";
import { INITIAL_ORDER_STATUS, DEFAULT_DELIVERY_FEE_CENTS } from "@backend/modules/orders/orders.workflow";
import type { OrderDraftItem, OrderListItem, OrderStatus } from "@backend/modules/orders/orders.types";

type PublicOrderInput = {
  deliveryAddress: string;
  recipientPhone: string;
  paymentMethod: string;
  customerComment: string | null;
  items: OrderDraftItem[];
};

export type PublicOrderStatus = {
  id: number;
  status: OrderStatus;
  totalCents: number;
  createdAt: string;
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeOptionalInteger(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

export function parsePublicOrderInput(body: unknown): PublicOrderInput {
  const payload = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const deliveryAddress = normalizeText(payload.deliveryAddress);
  const recipientPhone = normalizeText(payload.recipientPhone);
  const paymentMethod = normalizeText(payload.paymentMethod);
  const customerComment = normalizeText(payload.customerComment) || null;
  const rawItems = Array.isArray(payload.items) ? payload.items : [];

  if (!deliveryAddress) {
    throw new ValidationError("Укажите адрес доставки");
  }

  if (!recipientPhone) {
    throw new ValidationError("Укажите телефон получателя");
  }

  if (!["cash", "courier_card", "online"].includes(paymentMethod)) {
    throw new ValidationError("Выберите способ оплаты");
  }

  const items = rawItems
    .map((item) => item && typeof item === "object" ? item as Record<string, unknown> : {})
    .map((item) => ({
      catalogItemId: Number(item.catalogItemId),
      catalogItemVariantId: normalizeOptionalInteger(item.catalogItemVariantId),
      excludedIngredientIds: Array.isArray(item.excludedIngredientIds)
        ? item.excludedIngredientIds
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0)
        : [],
      quantity: Number(item.quantity),
      choices: Array.isArray(item.choices)
        ? item.choices
            .map((choice) => choice && typeof choice === "object" ? choice as Record<string, unknown> : {})
            .map((choice) => ({
              choiceSlotId: Number(choice.choiceSlotId),
              position: normalizeOptionalInteger(choice.position),
              selectedCatalogItemId: Number(choice.selectedCatalogItemId),
              selectedCatalogItemVariantId: normalizeOptionalInteger(choice.selectedCatalogItemVariantId),
            }))
            .filter((choice) => Number.isInteger(choice.choiceSlotId) && Number.isInteger(choice.selectedCatalogItemId))
        : [],
    }))
    .filter((item) => Number.isInteger(item.catalogItemId) && Number.isInteger(item.quantity));

  if (!items.length || items.some((item) => item.quantity <= 0)) {
    throw new ValidationError("Добавьте позиции в корзину");
  }

  return { deliveryAddress, recipientPhone, paymentMethod, customerComment, items };
}

async function resolvePublicOrderEmployeeId() {
  if (backendEnv.publicOrderEmployeeId) {
    const configured = await pool.query<{ id: number }>(
      `SELECT "id" FROM "Employee" WHERE "id" = $1 LIMIT 1`,
      [backendEnv.publicOrderEmployeeId],
    );

    if (configured.rowCount) {
      return configured.rows[0].id;
    }
  }

  const fallback = await pool.query<{ id: number }>(
    `
      SELECT "id"
      FROM "Employee"
      ORDER BY
        CASE "role"
          WHEN 'Диспетчер' THEN 1
          WHEN 'Управляющий' THEN 2
          WHEN 'Администратор' THEN 3
          WHEN 'admin' THEN 4
          ELSE 5
        END,
        "id" ASC
      LIMIT 1
    `,
  );

  if (!fallback.rowCount) {
    throw new ValidationError("В CRM нет сотрудника для приема заказа с сайта");
  }

  return fallback.rows[0].id;
}

function toPublicOrderStatus(order: OrderListItem): PublicOrderStatus {
  return {
    id: order.id,
    status: order.status,
    totalCents: order.totalCents,
    createdAt: order.createdAt,
  };
}

export async function createPublicOrder(phone: string, input: PublicOrderInput) {
  const client = await findPublicClientByPhone(phone);

  if (!client) {
    throw new ValidationError("Войдите или зарегистрируйтесь перед оформлением заказа");
  }

  await saveDeliveryAddressToClient(client, input.deliveryAddress);

  const order = await createOrder({
    clientId: client.id,
    employeeId: await resolvePublicOrderEmployeeId(),
    isInternal: false,
    status: INITIAL_ORDER_STATUS,
    deliveryFeeCents: DEFAULT_DELIVERY_FEE_CENTS,
    source: "SITE",
    customerPhoneSnapshot: input.recipientPhone,
    deliveryAddressSnapshot: input.deliveryAddress,
    customerComment: buildPublicOrderComment(input.paymentMethod, input.customerComment),
    items: input.items,
  });

  return toPublicOrderStatus(order);
}

async function saveDeliveryAddressToClient(client: NonNullable<Awaited<ReturnType<typeof findPublicClientByPhone>>>, address: string) {
  const addresses = (client.address ?? "")
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (addresses.includes(address)) {
    return;
  }

  await updateClient(client.id, {
    name: client.name,
    type: client.type,
    email: client.email,
    phone: client.phone,
    birthDate: client.birthDate,
    address: [...addresses, address].join("\n"),
    notes: client.notes,
    loyaltyLevelOverride: client.loyaltyLevelOverride,
  });
}

function buildPublicOrderComment(paymentMethod: string, customerComment: string | null) {
  const paymentLabel: Record<string, string> = {
    cash: "наличные",
    courier_card: "картой курьеру",
    online: "онлайн оплата",
  };
  const paymentComment = `Оплата: ${paymentLabel[paymentMethod] ?? paymentMethod}.`;

  return customerComment ? `${paymentComment}\n${customerComment}` : paymentComment;
}

export async function fetchPublicOrderStatus(orderId: number, phone: string) {
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return null;
  }

  const result = await pool.query<{
    id: number;
    status: OrderStatus;
    totalCents: number;
    createdAt: Date;
  }>(
    `
      SELECT o."id", o."status", o."totalCents", o."createdAt"
      FROM "Order" o
      INNER JOIN "Client" c ON c."id" = o."clientId"
      WHERE o."id" = $1 AND c."phone" = $2
      LIMIT 1
    `,
    [orderId, phone],
  );

  const row = result.rows[0];
  return row
    ? {
        id: row.id,
        status: row.status,
        totalCents: row.totalCents,
        createdAt: row.createdAt.toISOString(),
      }
    : null;
}
