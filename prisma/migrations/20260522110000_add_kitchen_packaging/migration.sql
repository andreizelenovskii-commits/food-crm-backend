ALTER TABLE "Product" ADD COLUMN "kitchenZone" TEXT;

CREATE TABLE "OrderPackagingUsage" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "orderItemId" INTEGER NOT NULL,
    "unitIndex" INTEGER NOT NULL,
    "packageProductId" INTEGER NOT NULL,
    "packageProductName" TEXT NOT NULL,
    "kitchenZone" TEXT NOT NULL,
    "actorUserId" INTEGER,
    "stockQuantityBefore" DOUBLE PRECISION NOT NULL,
    "stockQuantityAfter" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderPackagingUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderPackagingUsage_orderItemId_unitIndex_key"
    ON "OrderPackagingUsage"("orderItemId", "unitIndex");

CREATE INDEX "OrderPackagingUsage_orderId_createdAt_idx"
    ON "OrderPackagingUsage"("orderId", "createdAt");

CREATE INDEX "OrderPackagingUsage_packageProductId_createdAt_idx"
    ON "OrderPackagingUsage"("packageProductId", "createdAt");

ALTER TABLE "OrderPackagingUsage"
    ADD CONSTRAINT "OrderPackagingUsage_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderPackagingUsage"
    ADD CONSTRAINT "OrderPackagingUsage_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderPackagingUsage"
    ADD CONSTRAINT "OrderPackagingUsage_packageProductId_fkey"
    FOREIGN KEY ("packageProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
