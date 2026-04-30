export const CATALOG_PRICE_LIST_TYPES = ["CLIENT", "INTERNAL"] as const;

export type CatalogPriceListType = (typeof CATALOG_PRICE_LIST_TYPES)[number];

export const CATALOG_PRICE_LIST_LABELS: Record<CatalogPriceListType, string> = {
  CLIENT: "Клиентский прайс",
  INTERNAL: "Внутренний прайс",
};

export type CatalogItem = {
  id: number;
  name: string;
  priceListType: CatalogPriceListType;
  category: string | null;
  pizzaSize: string | null;
  description: string | null;
  imageUrl: string | null;
  priceCents: number;
  createdAt: string;
  technologicalCardId: number;
  technologicalCardName: string;
};
