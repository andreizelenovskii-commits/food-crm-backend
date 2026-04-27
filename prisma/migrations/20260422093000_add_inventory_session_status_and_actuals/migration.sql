ALTER TABLE "InventorySession"
ADD COLUMN "closedAt" TIMESTAMP(3);

ALTER TABLE "InventorySessionItem"
ADD COLUMN "actualQuantity" INTEGER;

CREATE INDEX "InventorySession_closedAt_createdAt_idx"
ON "InventorySession"("closedAt", "createdAt" DESC);
