import { fetchClients } from "@backend/modules/clients/clients.service";
import {
  LOYALTY_LEVELS,
  type LoyaltySnapshot,
} from "@backend/modules/loyalty/loyalty.types";
import {
  LOYALTY_LEVEL_CONFIG,
  mapClientToLoyaltyClient,
} from "@backend/modules/loyalty/loyalty.rules";

export async function fetchLoyaltySnapshot(): Promise<LoyaltySnapshot> {
  const clients = await fetchClients();
  const loyaltyClients = clients
    .filter((client) => client.type === "CLIENT")
    .map(mapClientToLoyaltyClient)
    .sort((left, right) => right.totalSpentCents - left.totalSpentCents);

  return {
    participantsCount: loyaltyClients.length,
    activeLevelsCount: LOYALTY_LEVELS.length,
    monthlyParticipantsCount: loyaltyClients.filter((client) => client.ordersCount > 0).length,
    clients: loyaltyClients,
    byLevel: LOYALTY_LEVELS.map((level) => ({
      level,
      clients: loyaltyClients.filter((client) => client.level === level),
      config: LOYALTY_LEVEL_CONFIG.find((entry) => entry.level === level)!,
    })),
  };
}
