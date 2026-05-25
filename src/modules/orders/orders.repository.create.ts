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
import { calculateOrderPricing } from "@backend/modules/orders/orders.pricing";
import {
  DELIVERY_ITEM_NAME,
  mapRowToOrder,
  type CatalogOrderItemRow,
  type CatalogVariantOrderRow,
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
        LEFT JOIN "Order" o ON o."clientId" = c."id" AND o."status" = 'DELIVERED_PAID'
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

    const catalogItemIds = [
      ...new Set([
        ...input.items.map((item) => item.catalogItemId),
        ...input.items.flatMap((item) =>
          (item.choices ?? []).map((choice) => choice.selectedCatalogItemId),
        ),
      ]),
    ];
    const catalogVariantIds = input.items
      .map((item) => item.catalogItemVariantId)
      .filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0);
    const excludedIngredientIds = [
      ...new Set(input.items.flatMap((item) => item.excludedIngredientIds ?? [])),
    ];
    const catalogItemsResult = await client.query<CatalogOrderItemRow>(
      `
        SELECT
          c."id",
          c."name",
          c."priceCents",
          c."isPublished",
          c."technologicalCardId",
          t."pizzaSize",
          t."rollSize"
        FROM "CatalogItem" c
        INNER JOIN "TechnologicalCard" t ON t."id" = c."technologicalCardId"
        WHERE c."id" = ANY($1::int[])
      `,
      [catalogItemIds],
    );
    const catalogVariantsResult = catalogVariantIds.length
      ? await client.query<CatalogVariantOrderRow>(
          `
            SELECT
              v."id",
              v."catalogItemId",
              v."technologicalCardId",
              v."label",
              v."priceCents",
              t."pizzaSize",
              t."rollSize"
            FROM "CatalogItemVariant" v
            INNER JOIN "TechnologicalCard" t ON t."id" = v."technologicalCardId"
            WHERE v."id" = ANY($1::int[])
          `,
          [catalogVariantIds],
        )
      : { rows: [] as CatalogVariantOrderRow[], rowCount: 0 };
    const exclusionsResult = excludedIngredientIds.length
      ? await client.query<{
          id: number;
          catalogItemId: number;
          productId: number;
          label: string;
        }>(
          `
            SELECT
              "id",
              "catalogItemId",
              "productId",
              "label"
            FROM "CatalogItemExcludedIngredient"
            WHERE "id" = ANY($1::int[])
          `,
          [excludedIngredientIds],
        )
      : { rows: [] as Array<{ id: number; catalogItemId: number; productId: number; label: string }>, rowCount: 0 };

    if (catalogItemsResult.rowCount !== catalogItemIds.length) {
      throw new ValidationError("Часть позиций заказа не найдена в каталоге");
    }

    const catalogItemsById = new Map(catalogItemsResult.rows.map((item) => [item.id, item]));
    const catalogVariantsById = new Map(catalogVariantsResult.rows.map((variant) => [variant.id, variant]));
    const exclusionsById = new Map(exclusionsResult.rows.map((exclusion) => [exclusion.id, exclusion]));
    const expectedIsPublished = !input.isInternal;
    const orderChoicesByCatalogItemId = new Map<number, Array<{
      choiceSlotId: number;
      selectedTechnologicalCardId: number;
      quantity: number;
    }>>();
    const choiceLabelsByCatalogItemId = new Map<number, string[]>();

    for (const item of input.items) {
      const rootCatalogItem = catalogItemsById.get(item.catalogItemId);

      if (!rootCatalogItem) {
        continue;
      }

      const slotsResult = await client.query<{
        id: number;
        name: string;
        category: string;
        allowedPizzaSizes: string[];
        quantity: number;
      }>(
        `
          SELECT "id", "name", "category", "allowedPizzaSizes", "quantity"
          FROM "TechCardChoiceSlot"
          WHERE "technologicalCardId" = $1
          ORDER BY "id" ASC
        `,
        [rootCatalogItem.technologicalCardId],
      );
      const choices = item.choices ?? [];

      if (slotsResult.rowCount !== choices.length) {
        throw new ValidationError(`Для позиции "${rootCatalogItem.name}" выберите все варианты комбо`);
      }

      const preparedChoices = slotsResult.rows.map((slot) => {
        const choice = choices.find((entry) => entry.choiceSlotId === slot.id);
        const selectedCatalogItem = choice
          ? catalogItemsById.get(choice.selectedCatalogItemId)
          : null;

        if (!choice || !selectedCatalogItem) {
          throw new ValidationError(`Для позиции "${rootCatalogItem.name}" выберите все варианты комбо`);
        }

        if (selectedCatalogItem.isPublished !== expectedIsPublished) {
          throw new ValidationError("Вариант комбо должен быть из того же прайса, что и заказ");
        }

        return {
          choiceSlotId: slot.id,
          selectedCatalogItem,
          slot,
        };
      });

      if (preparedChoices.length > 0) {
        choiceLabelsByCatalogItemId.set(
          item.catalogItemId,
          preparedChoices.map((choice) => {
            const variant = choice.selectedCatalogItem.pizzaSize ?? choice.selectedCatalogItem.rollSize;
            return `${choice.slot.name}: ${choice.selectedCatalogItem.name}${variant ? ` ${variant}` : ""}`;
          }),
        );
        const selectedTechCardsResult = await client.query<{
          id: number;
          category: string;
          pizzaSize: string | null;
        }>(
          `
            SELECT "id", "category", "pizzaSize"
            FROM "TechnologicalCard"
            WHERE "id" = ANY($1::int[])
          `,
          [preparedChoices.map((choice) => choice.selectedCatalogItem.technologicalCardId)],
        );
        const selectedTechCardsById = new Map(selectedTechCardsResult.rows.map((techCard) => [techCard.id, techCard]));

        orderChoicesByCatalogItemId.set(
          item.catalogItemId,
          preparedChoices.map((choice) => {
            const selectedTechCard = selectedTechCardsById.get(choice.selectedCatalogItem.technologicalCardId);

            if (!selectedTechCard || selectedTechCard.category !== choice.slot.category) {
              throw new ValidationError("Выбранный вариант комбо не подходит по категории");
            }

            if (
              choice.slot.allowedPizzaSizes.length > 0 &&
              !choice.slot.allowedPizzaSizes.includes(selectedTechCard.pizzaSize ?? "")
            ) {
              throw new ValidationError("Выбранный вариант комбо не подходит по размеру");
            }

            return {
              choiceSlotId: choice.slot.id,
              selectedTechnologicalCardId: selectedTechCard.id,
              quantity: choice.slot.quantity,
            };
          }),
        );
      }
    }

    const orderItems = input.items.map((item) => {
      const catalogItem = catalogItemsById.get(item.catalogItemId);
      const catalogVariant = item.catalogItemVariantId
        ? catalogVariantsById.get(item.catalogItemVariantId)
        : null;

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

      if (item.catalogItemVariantId && (!catalogVariant || catalogVariant.catalogItemId !== catalogItem.id)) {
        throw new ValidationError(`Выбранный вариант позиции "${catalogItem.name}" недоступен`);
      }

      const activeVariant = catalogVariant ?? {
        id: null,
        label: catalogItem.pizzaSize ?? catalogItem.rollSize ?? "",
        priceCents: catalogItem.priceCents,
      };
      const variantLabel = activeVariant.label ? ` ${activeVariant.label}` : "";
      const excludedIngredients = (item.excludedIngredientIds ?? []).map((exclusionId) => {
        const exclusion = exclusionsById.get(exclusionId);

        if (!exclusion || exclusion.catalogItemId !== catalogItem.id) {
          throw new ValidationError(`Исключаемый ингредиент для "${catalogItem.name}" недоступен`);
        }

        return exclusion;
      });
      const exclusionLabels = excludedIngredients.map((ingredient) => `Без ${ingredient.label}`);

      return {
        catalogItemId: catalogItem.id,
        catalogItemVariantId: activeVariant.id,
        itemName: [
          `${catalogItem.name}${variantLabel}`,
          ...(choiceLabelsByCatalogItemId.get(catalogItem.id) ?? []),
          ...exclusionLabels,
        ].join(" · "),
        excludedIngredients,
        quantity: item.quantity,
        unitPriceCents: activeVariant.priceCents,
        totalPriceCents: activeVariant.priceCents * item.quantity,
      };
    });

    const itemsTotalCents = orderItems.reduce((sum, item) => sum + item.totalPriceCents, 0);
    const currentClient = clientExists.rows[0];
    const discountPercent =
      !input.isInternal && currentClient.type === "CLIENT"
        ? getLoyaltyDiscountPercent(
            currentClient.loyaltyLevelOverride ??
              resolveLoyaltyLevel(Number(currentClient.totalSpentCents ?? 0)),
          )
        : 0;
    const pricing = calculateOrderPricing({
      itemsTotalCents,
      deliveryFeeCents: input.deliveryFeeCents,
      discountPercent,
      isInternal: input.isInternal,
    });

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
        pricing.subtotalCents,
        discountPercent,
        pricing.totalCents,
      ],
    );

    const order = result.rows[0];

    for (const item of orderItems) {
      const insertedItem = await client.query<{ id: number }>(
        `
          INSERT INTO "OrderItem" (
            "orderId",
            "catalogItemId",
            "catalogItemVariantId",
            "itemName",
            "quantity",
            "unitPriceCents",
            "totalPriceCents"
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING "id"
        `,
        [
          order.id,
          item.catalogItemId,
          item.catalogItemVariantId,
          item.itemName,
          item.quantity,
          item.unitPriceCents,
          item.totalPriceCents,
        ],
      );

      for (const choice of orderChoicesByCatalogItemId.get(item.catalogItemId) ?? []) {
        await client.query(
          `
            INSERT INTO "OrderItemChoice" (
              "orderItemId",
              "choiceSlotId",
              "selectedTechnologicalCardId",
              "quantity"
            )
            VALUES ($1, $2, $3, $4)
          `,
          [
            insertedItem.rows[0].id,
            choice.choiceSlotId,
            choice.selectedTechnologicalCardId,
            choice.quantity,
          ],
        );
      }

      for (const exclusion of item.excludedIngredients) {
        await client.query(
          `
            INSERT INTO "OrderItemExcludedIngredient" (
              "orderItemId",
              "catalogItemExcludedIngredientId",
              "productId",
              "label"
            )
            VALUES ($1, $2, $3, $4)
          `,
          [
            insertedItem.rows[0].id,
            exclusion.id,
            exclusion.productId,
            exclusion.label,
          ],
        );
      }
    }

    if (pricing.deliveryFeeCents > 0) {
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
        [order.id, DELIVERY_ITEM_NAME, pricing.deliveryFeeCents],
      );
    }

    return mapRowToOrder(order);
  });
}
