CREATE TABLE "TechnologicalCard" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "outputQuantity" INTEGER NOT NULL,
  "outputUnit" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TechnologicalCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TechCardIngredient" (
  "id" SERIAL NOT NULL,
  "technologicalCardId" INTEGER NOT NULL,
  "productId" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  CONSTRAINT "TechCardIngredient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogItem" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "category" TEXT,
  "description" TEXT,
  "priceCents" INTEGER NOT NULL,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "technologicalCardId" INTEGER NOT NULL,
  CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TechnologicalCard_name_key" ON "TechnologicalCard"("name");
CREATE UNIQUE INDEX "CatalogItem_slug_key" ON "CatalogItem"("slug");

ALTER TABLE "TechCardIngredient"
ADD CONSTRAINT "TechCardIngredient_technologicalCardId_fkey"
FOREIGN KEY ("technologicalCardId") REFERENCES "TechnologicalCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TechCardIngredient"
ADD CONSTRAINT "TechCardIngredient_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CatalogItem"
ADD CONSTRAINT "CatalogItem_technologicalCardId_fkey"
FOREIGN KEY ("technologicalCardId") REFERENCES "TechnologicalCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
