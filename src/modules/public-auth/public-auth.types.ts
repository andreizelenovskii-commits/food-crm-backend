export type PublicAuthPurpose = "register" | "login";

export type PublicClientSession = {
  clientId: number;
  phone: string;
  expiresAt: number;
};

export type PublicClientProfile = {
  name: string;
  phone: string;
  birthDate: string | null;
  totalSpentCents: number;
  loyaltyLevel: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | null;
  loyaltyNextLevel: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | null;
  loyaltyAmountToNextLevelCents: number;
};
