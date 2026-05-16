CREATE TABLE "OrderInventoryMovement" (
  "id" SERIAL PRIMARY KEY,
  "orderId" INTEGER NOT NULL,
  "productId" INTEGER NOT NULL,
  "productName" TEXT NOT NULL,
  "productUnit" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "movementType" TEXT NOT NULL,
  "orderStatus" "OrderStatus" NOT NULL,
  "reason" TEXT NOT NULL,
  "actorUserId" INTEGER,
  "stockQuantityBefore" DOUBLE PRECISION NOT NULL,
  "stockQuantityAfter" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "OrderInventoryMovement"
ADD CONSTRAINT "OrderInventoryMovement_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderInventoryMovement"
ADD CONSTRAINT "OrderInventoryMovement_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "OrderInventoryMovement_orderId_productId_movementType_key"
ON "OrderInventoryMovement"("orderId", "productId", "movementType");

CREATE INDEX "OrderInventoryMovement_orderId_createdAt_idx"
ON "OrderInventoryMovement"("orderId", "createdAt");

CREATE INDEX "OrderInventoryMovement_productId_createdAt_idx"
ON "OrderInventoryMovement"("productId", "createdAt");
