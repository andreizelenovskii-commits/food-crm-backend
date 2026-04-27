export const LOYALTY_LEVELS = ["BRONZE", "SILVER", "GOLD", "PLATINUM"] as const;

export type LoyaltyLevel = (typeof LOYALTY_LEVELS)[number];

export const LOYALTY_LEVEL_LABELS: Record<LoyaltyLevel, string> = {
  BRONZE: "Бронзовый",
  SILVER: "Серебряный",
  GOLD: "Золотой",
  PLATINUM: "Платиновый",
};

export const LOYALTY_LEVEL_STYLES: Record<LoyaltyLevel, string> = {
  BRONZE: "from-orange-50 to-amber-100 border-orange-200 text-orange-950",
  SILVER: "from-zinc-50 to-slate-200 border-slate-200 text-slate-950",
  GOLD: "from-amber-50 to-yellow-200 border-yellow-200 text-yellow-950",
  PLATINUM: "from-cyan-50 to-teal-100 border-teal-200 text-teal-950",
};

export type LoyaltyLevelConfig = {
  level: LoyaltyLevel;
  minSpentCents: number;
  discountPercent: number;
  perks: string[];
};

export type LoyaltyClient = {
  id: number;
  name: string;
  phone: string;
  ordersCount: number;
  totalSpentCents: number;
  level: LoyaltyLevel;
  nextLevel: LoyaltyLevel | null;
  amountToNextLevelCents: number;
};

export type LoyaltySnapshot = {
  participantsCount: number;
  activeLevelsCount: number;
  monthlyParticipantsCount: number;
  clients: LoyaltyClient[];
  byLevel: Array<{
    level: LoyaltyLevel;
    clients: LoyaltyClient[];
    config: LoyaltyLevelConfig;
  }>;
};
