export const CLIENT_TYPES = ["CLIENT", "ORGANIZATION"] as const;

export type ClientType = (typeof CLIENT_TYPES)[number];

export type ClientLoyaltyLevel = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";

export type Client = {
  id: number;
  name: string;
  type: ClientType;
  email: string | null;
  phone: string;
  birthDate: string | null;
  address: string | null;
  notes: string | null;
  ordersCount: number;
  totalSpentCents: number;
  loyaltyLevel: ClientLoyaltyLevel | null;
  loyaltyNextLevel: ClientLoyaltyLevel | null;
  loyaltyAmountToNextLevelCents: number;
  createdAt: string;
};
