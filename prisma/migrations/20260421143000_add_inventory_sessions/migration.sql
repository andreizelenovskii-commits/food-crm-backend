CREATE TABLE "InventorySession" (
  "id" SERIAL NOT NULL,
  "responsibleEmployeeId" INTEGER NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InventorySession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventorySessionItem" (
  "id" SERIAL NOT NULL,
  "inventorySessionId" INTEGER NOT NULL,
  "productId" INTEGER NOT NULL,
  "productName" TEXT NOT NULL,
  "productCategory" TEXT,
  "productUnit" TEXT NOT NULL,
  "stockQuantity" INTEGER NOT NULL,

  CONSTRAINT "InventorySessionItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InventorySession"
ADD CONSTRAINT "InventorySession_responsibleEmployeeId_fkey"
FOREIGN KEY ("responsibleEmployeeId") REFERENCES "Employee"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventorySessionItem"
ADD CONSTRAINT "InventorySessionItem_inventorySessionId_fkey"
FOREIGN KEY ("inventorySessionId") REFERENCES "InventorySession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventorySessionItem"
ADD CONSTRAINT "InventorySessionItem_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "InventorySession_responsibleEmployeeId_createdAt_idx"
ON "InventorySession"("responsibleEmployeeId", "createdAt" DESC);

CREATE INDEX "InventorySessionItem_inventorySessionId_idx"
ON "InventorySessionItem"("inventorySessionId");

CREATE UNIQUE INDEX "InventorySessionItem_inventorySessionId_productId_key"
ON "InventorySessionItem"("inventorySessionId", "productId");
