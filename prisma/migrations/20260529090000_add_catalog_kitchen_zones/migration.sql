ALTER TABLE "CatalogItem"
    ADD COLUMN "kitchenZones" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "CatalogItem"
SET "kitchenZones" = CASE
    WHEN "kitchenZone" IS NULL OR "kitchenZone" = '' THEN ARRAY[]::TEXT[]
    ELSE ARRAY["kitchenZone"]
END;

DROP INDEX IF EXISTS "OrderPackagingUsage_orderItemId_unitIndex_key";

CREATE UNIQUE INDEX "OrderPackagingUsage_orderItemId_unitIndex_kitchenZone_key"
    ON "OrderPackagingUsage"("orderItemId", "unitIndex", "kitchenZone");
