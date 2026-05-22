CREATE TABLE "CatalogItemExcludedIngredient" (
    "id" SERIAL NOT NULL,
    "catalogItemId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CatalogItemExcludedIngredient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CatalogItemExcludedIngredient_catalogItemId_productId_key"
    ON "CatalogItemExcludedIngredient"("catalogItemId", "productId");

CREATE INDEX "CatalogItemExcludedIngredient_productId_idx"
    ON "CatalogItemExcludedIngredient"("productId");

ALTER TABLE "CatalogItemExcludedIngredient"
    ADD CONSTRAINT "CatalogItemExcludedIngredient_catalogItemId_fkey"
    FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CatalogItemExcludedIngredient"
    ADD CONSTRAINT "CatalogItemExcludedIngredient_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "OrderItemExcludedIngredient" (
    "id" SERIAL NOT NULL,
    "orderItemId" INTEGER NOT NULL,
    "catalogItemExcludedIngredientId" INTEGER,
    "productId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "OrderItemExcludedIngredient_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderItemExcludedIngredient_catalogItemExcludedIngredientId_idx"
    ON "OrderItemExcludedIngredient"("catalogItemExcludedIngredientId");

CREATE INDEX "OrderItemExcludedIngredient_productId_idx"
    ON "OrderItemExcludedIngredient"("productId");

ALTER TABLE "OrderItemExcludedIngredient"
    ADD CONSTRAINT "OrderItemExcludedIngredient_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderItemExcludedIngredient"
    ADD CONSTRAINT "OrderItemExcludedIngredient_catalogItemExcludedIngredientId_fkey"
    FOREIGN KEY ("catalogItemExcludedIngredientId") REFERENCES "CatalogItemExcludedIngredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderItemExcludedIngredient"
    ADD CONSTRAINT "OrderItemExcludedIngredient_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
