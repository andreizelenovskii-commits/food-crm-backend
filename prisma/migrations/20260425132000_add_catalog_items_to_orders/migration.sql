ALTER TABLE "OrderItem"
ALTER COLUMN "productId" DROP NOT NULL;

ALTER TABLE "OrderItem"
ADD COLUMN "catalogItemId" INTEGER,
ADD COLUMN "itemName" TEXT;

UPDATE "OrderItem" oi
SET "itemName" = p."name"
FROM "Product" p
WHERE oi."productId" = p."id"
  AND oi."itemName" IS NULL;

ALTER TABLE "OrderItem"
ALTER COLUMN "itemName" SET NOT NULL;

ALTER TABLE "OrderItem"
ADD CONSTRAINT "OrderItem_catalogItemId_fkey"
FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
