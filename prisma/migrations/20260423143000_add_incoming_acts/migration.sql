CREATE TABLE "IncomingAct" (
  "id" SERIAL NOT NULL,
  "responsibleEmployeeId" INTEGER NOT NULL,
  "supplierName" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "IncomingAct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IncomingActItem" (
  "id" SERIAL NOT NULL,
  "incomingActId" INTEGER NOT NULL,
  "productId" INTEGER NOT NULL,
  "productName" TEXT NOT NULL,
  "productCategory" TEXT,
  "productUnit" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "priceCents" INTEGER NOT NULL,
  "stockQuantityBefore" DOUBLE PRECISION,
  "stockQuantityAfter" DOUBLE PRECISION,

  CONSTRAINT "IncomingActItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "IncomingAct"
ADD CONSTRAINT "IncomingAct_responsibleEmployeeId_fkey"
FOREIGN KEY ("responsibleEmployeeId") REFERENCES "Employee"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IncomingActItem"
ADD CONSTRAINT "IncomingActItem_incomingActId_fkey"
FOREIGN KEY ("incomingActId") REFERENCES "IncomingAct"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IncomingActItem"
ADD CONSTRAINT "IncomingActItem_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "IncomingAct_responsibleEmployeeId_createdAt_idx"
ON "IncomingAct"("responsibleEmployeeId", "createdAt" DESC);

CREATE INDEX "IncomingAct_completedAt_createdAt_idx"
ON "IncomingAct"("completedAt", "createdAt" DESC);

CREATE INDEX "IncomingActItem_incomingActId_idx"
ON "IncomingActItem"("incomingActId");

CREATE UNIQUE INDEX "IncomingActItem_incomingActId_productId_key"
ON "IncomingActItem"("incomingActId", "productId");
