ALTER TABLE "InventorySessionItem"
DROP CONSTRAINT "InventorySessionItem_productId_fkey";

ALTER TABLE "InventorySessionItem"
ALTER COLUMN "productId" DROP NOT NULL;

ALTER TABLE "InventorySessionItem"
ADD CONSTRAINT "InventorySessionItem_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
