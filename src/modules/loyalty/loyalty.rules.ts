import type { Client } from "@backend/modules/clients/clients.types";
import {
  LOYALTY_LEVELS,
  type LoyaltyClient,
  type LoyaltyLevel,
  type LoyaltyLevelConfig,
} from "@backend/modules/loyalty/loyalty.types";

export const LOYALTY_LEVEL_CONFIG: LoyaltyLevelConfig[] = [
  {
    level: "BRONZE",
    minSpentCents: 0,
    discountPercent: 3,
    perks: ["Базовая скидка на повторные заказы", "Участие в персональных акциях"],
  },
  {
    level: "SILVER",
    minSpentCents: 20_000_00,
    discountPercent: 5,
    perks: ["Повышенная скидка", "Приоритет в рассылках и спецпредложениях"],
  },
  {
    level: "GOLD",
    minSpentCents: 50_000_00,
    discountPercent: 7,
    perks: ["Расширенная скидка", "Персональные предложения ко дню рождения"],
  },
  {
    level: "PLATINUM",
    minSpentCents: 100_000_00,
    discountPercent: 10,
    perks: ["Максимальная скидка", "Приоритетные спецусловия для постоянных клиентов"],
  },
];

export function resolveLoyaltyLevel(totalSpentCents: number): LoyaltyLevel {
  const matched = [...LOYALTY_LEVEL_CONFIG]
    .reverse()
    .find((level) => totalSpentCents >= level.minSpentCents);

  return matched?.level ?? "BRONZE";
}

export function getLoyaltyDiscountPercent(level: LoyaltyLevel | null) {
  if (!level) {
    return 0;
  }

  return LOYALTY_LEVEL_CONFIG.find((entry) => entry.level === level)?.discountPercent ?? 0;
}

export function getNextLoyaltyLevel(level: LoyaltyLevel) {
  const index = LOYALTY_LEVELS.indexOf(level);

  if (index === -1 || index === LOYALTY_LEVELS.length - 1) {
    return null;
  }

  return LOYALTY_LEVELS[index + 1] ?? null;
}

export function attachLoyaltyToClient<T extends Client>(client: T): T {
  if (client.type !== "CLIENT") {
    return {
      ...client,
      loyaltyLevel: null,
      loyaltyNextLevel: null,
      loyaltyAmountToNextLevelCents: 0,
    };
  }

  const loyaltyLevel = resolveLoyaltyLevel(client.totalSpentCents);
  const loyaltyNextLevel = getNextLoyaltyLevel(loyaltyLevel);
  const nextLevelConfig = LOYALTY_LEVEL_CONFIG.find((entry) => entry.level === loyaltyNextLevel);

  return {
    ...client,
    loyaltyLevel,
    loyaltyNextLevel,
    loyaltyAmountToNextLevelCents: nextLevelConfig
      ? Math.max(nextLevelConfig.minSpentCents - client.totalSpentCents, 0)
      : 0,
  };
}

export function mapClientToLoyaltyClient(client: Client): LoyaltyClient {
  const enrichedClient = attachLoyaltyToClient(client);

  if (!enrichedClient.loyaltyLevel) {
    throw new Error("Loyalty level is only available for client profiles");
  }

  return {
    id: enrichedClient.id,
    name: enrichedClient.name,
    phone: enrichedClient.phone,
    ordersCount: enrichedClient.ordersCount,
    totalSpentCents: enrichedClient.totalSpentCents,
    level: enrichedClient.loyaltyLevel,
    nextLevel: enrichedClient.loyaltyNextLevel,
    amountToNextLevelCents: enrichedClient.loyaltyAmountToNextLevelCents,
  };
}
