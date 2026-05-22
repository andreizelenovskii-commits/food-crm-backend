ALTER TABLE "CatalogItem" ADD COLUMN "kitchenZone" TEXT;

CREATE TABLE "CatalogItemVariant" (
    "id" SERIAL NOT NULL,
    "catalogItemId" INTEGER NOT NULL,
    "technologicalCardId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CatalogItemVariant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CatalogItemVariant_catalogItemId_technologicalCardId_key"
    ON "CatalogItemVariant"("catalogItemId", "technologicalCardId");

CREATE INDEX "CatalogItemVariant_technologicalCardId_idx"
    ON "CatalogItemVariant"("technologicalCardId");

ALTER TABLE "CatalogItemVariant"
    ADD CONSTRAINT "CatalogItemVariant_catalogItemId_fkey"
    FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CatalogItemVariant"
    ADD CONSTRAINT "CatalogItemVariant_technologicalCardId_fkey"
    FOREIGN KEY ("technologicalCardId") REFERENCES "TechnologicalCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "CatalogItemVariant" (
    "catalogItemId",
    "technologicalCardId",
    "label",
    "priceCents",
    "isDefault",
    "displayOrder"
)
SELECT
    c."id",
    c."technologicalCardId",
    COALESCE(t."pizzaSize", t."rollSize", 'Стандарт'),
    c."priceCents",
    TRUE,
    0
FROM "CatalogItem" c
INNER JOIN "TechnologicalCard" t ON t."id" = c."technologicalCardId";

UPDATE "CatalogItem"
SET "kitchenZone" = CASE
    WHEN "category" = 'Пицца' THEN 'pizza'
    WHEN "category" IN ('Роллы', 'Онигири', 'Суши-доги') THEN 'rolls'
    WHEN "category" = 'Фастфуд' THEN 'fastfood'
    ELSE NULL
END;

ALTER TABLE "OrderItem" ADD COLUMN "catalogItemVariantId" INTEGER;

UPDATE "OrderItem" oi
SET "catalogItemVariantId" = v."id"
FROM "CatalogItemVariant" v
WHERE v."catalogItemId" = oi."catalogItemId"
  AND v."isDefault" = TRUE;

CREATE INDEX "OrderItem_catalogItemVariantId_idx"
    ON "OrderItem"("catalogItemVariantId");

ALTER TABLE "OrderItem"
    ADD CONSTRAINT "OrderItem_catalogItemVariantId_fkey"
    FOREIGN KEY ("catalogItemVariantId") REFERENCES "CatalogItemVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
