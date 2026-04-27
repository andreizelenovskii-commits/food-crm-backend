CREATE TABLE "WriteoffAct" (
  "id" SERIAL NOT NULL,
  "responsibleEmployeeId" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "WriteoffAct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WriteoffActItem" (
  "id" SERIAL NOT NULL,
  "writeoffActId" INTEGER NOT NULL,
  "productId" INTEGER NOT NULL,
  "productName" TEXT NOT NULL,
  "productCategory" TEXT,
  "productUnit" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "priceCents" INTEGER NOT NULL,
  "stockQuantityBefore" INTEGER,
  "stockQuantityAfter" INTEGER,

  CONSTRAINT "WriteoffActItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WriteoffAct"
ADD CONSTRAINT "WriteoffAct_responsibleEmployeeId_fkey"
FOREIGN KEY ("responsibleEmployeeId") REFERENCES "Employee"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WriteoffActItem"
ADD CONSTRAINT "WriteoffActItem_writeoffActId_fkey"
FOREIGN KEY ("writeoffActId") REFERENCES "WriteoffAct"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WriteoffActItem"
ADD CONSTRAINT "WriteoffActItem_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "WriteoffAct_responsibleEmployeeId_createdAt_idx"
ON "WriteoffAct"("responsibleEmployeeId", "createdAt" DESC);

CREATE INDEX "WriteoffAct_completedAt_createdAt_idx"
ON "WriteoffAct"("completedAt", "createdAt" DESC);

CREATE INDEX "WriteoffActItem_writeoffActId_idx"
ON "WriteoffActItem"("writeoffActId");

CREATE UNIQUE INDEX "WriteoffActItem_writeoffActId_productId_key"
ON "WriteoffActItem"("writeoffActId", "productId");
