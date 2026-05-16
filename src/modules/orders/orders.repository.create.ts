import { withTransaction } from "@backend/shared/db/transaction";
import { ValidationError } from "@backend/shared/errors/app-error";
import {
  getLoyaltyDiscountPercent,
  resolveLoyaltyLevel,
} from "@backend/modules/loyalty/loyalty.rules";
import type {
  OrderCreateInput,
  OrderListItem,
} from "@backend/modules/orders/orders.types";
import {
  DELIVERY_ITEM_NAME,
  mapRowToOrder,
  type CatalogOrderItemRow,
  type OrderRow,
} from "@backend/modules/orders/orders.repository.shared";

export async function createOrder(input: OrderCreateInput): Promise<OrderListItem> {
  return withTransaction(async (client) => {
    const clientExists = await client.query<{
      id: number;
      name: string;
      type: "CLIENT" | "ORGANIZATION";
      loyaltyLevelOverride: ReturnType<typeof resolveLoyaltyLevel>;
      totalSpentCents: string;
    }>(
      `
        SELECT
          c."id",
          c."name",
          c."type",
          c."loyaltyLevelOverride",
          COALESCE(SUM(o."totalCents"), 0) AS "totalSpentCents"
        FROM "Client" c
        LEFT JOIN "Order" o ON o."clientId" = c."id"
        WHERE c."id" = $1
        GROUP BY c."id", c."name", c."type", c."loyaltyLevelOverride"
        LIMIT 1
      `,
      [input.clientId],
    );

    if (!clientExists.rowCount) {
      throw new ValidationError("Клиент не найден");
    }

    const employeeExists = await client.query<{ id: number }>(
      `SELECT "id" FROM "Employee" WHERE "id" = $1 LIMIT 1`,
      [input.employeeId],
    );

    if (!employeeExists.rowCount) {
      throw new ValidationError("Сотрудник не найден");
    }

    const catalogItemIds = input.items.map((item) => item.catalogItemId);
    const catalogItemsResult = await client.query<CatalogOrderItemRow>(
      `
        SELECT "id", "name", "priceCents", "isPublished"
        FROM "CatalogItem"
        WHERE "id" = ANY($1::int[])
      `,
      [catalogItemIds],
    );

    if (catalogItemsResult.rowCount !== catalogItemIds.length) {
      throw new ValidationError("Часть позиций заказа не найдена в каталоге");
    }

    const catalogItemsById = new Map(catalogItemsResult.rows.map((item) => [item.id, item]));
    const expectedIsPublished = !input.isInternal;
    const orderItems = input.items.map((item) => {
      const catalogItem = catalogItemsById.get(item.catalogItemId);

      if (!catalogItem) {
        throw new ValidationError("Часть позиций заказа не найдена в каталоге");
      }

      if (catalogItem.isPublished !== expectedIsPublished) {
        throw new ValidationError(
          input.isInternal
            ? "Во внутренний заказ можно добавлять только позиции из внутреннего прайса"
            : "В клиентский заказ можно добавлять только позиции из клиентского прайса",
        );
      }

      return {
        catalogItemId: catalogItem.id,
        itemName: catalogItem.name,
        quantity: item.quantity,
        unitPriceCents: catalogItem.priceCents,
        totalPriceCents: catalogItem.priceCents * item.quantity,
      };
    });

    const subtotalCents = orderItems.reduce((sum, item) => sum + item.totalPriceCents, 0);
    const deliveryFeeCents = input.isInternal ? 0 : input.deliveryFeeCents;
    const currentClient = clientExists.rows[0];
    const discountPercent =
      !input.isInternal && currentClient.type === "CLIENT"
        ? getLoyaltyDiscountPercent(
            currentClient.loyaltyLevelOverride ??
              resolveLoyaltyLevel(Number(currentClient.totalSpentCents ?? 0)),
          )
        : 0;
    const discountCents = Math.round((subtotalCents * discountPercent) / 100);
    const totalCents = Math.max(subtotalCents - discountCents, 0) + deliveryFeeCents;

    const result = await client.query<OrderRow>(
      `
        INSERT INTO "Order" (
          "status",
          "source",
          "isInternal",
          "clientId",
          "clientNameSnapshot",
          "clientTypeSnapshot",
          "customerPhoneSnapshot",
          "deliveryAddressSnapshot",
          "customerComment",
          "employeeId",
          "subtotalCents",
          "discountPercent",
          "totalCents"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING
          "id",
          "status",
          "source",
          "isInternal",
          "customerPhoneSnapshot",
          "deliveryAddressSnapshot",
          "customerComment",
          "subtotalCents",
          "discountPercent",
          "totalCents",
          "createdAt",
          "clientId",
          "clientNameSnapshot" AS "clientName",
          "clientTypeSnapshot" AS "clientType",
          (SELECT e."id" FROM "Employee" e WHERE e."id" = $10) AS "employeeId",
          (SELECT e."name" FROM "Employee" e WHERE e."id" = $10) AS "employeeName"
      `,
      [
        input.status,
        input.source ?? "ADMIN",
        input.isInternal,
        input.clientId,
        currentClient.name,
        currentClient.type,
        input.customerPhoneSnapshot ?? null,
        input.deliveryAddressSnapshot ?? null,
        input.customerComment ?? null,
        input.employeeId,
        subtotalCents,
        discountPercent,
        totalCents,
      ],
    );

    const order = result.rows[0];

    for (const item of orderItems) {
      await client.query(
        `
          INSERT INTO "OrderItem" (
            "orderId",
            "catalogItemId",
            "itemName",
            "quantity",
            "unitPriceCents",
            "totalPriceCents"
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          order.id,
          item.catalogItemId,
          item.itemName,
          item.quantity,
          item.unitPriceCents,
          item.totalPriceCents,
        ],
      );
    }

    if (deliveryFeeCents > 0) {
      await client.query(
        `
          INSERT INTO "OrderItem" (
            "orderId",
            "catalogItemId",
            "itemName",
            "quantity",
            "unitPriceCents",
            "totalPriceCents"
          )
          VALUES ($1, NULL, $2, 1, $3, $3)
        `,
        [order.id, DELIVERY_ITEM_NAME, deliveryFeeCents],
      );
    }

    return mapRowToOrder(order);
  });
}
