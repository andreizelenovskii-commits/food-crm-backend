CREATE TYPE "ManagementAccountingEntryType" AS ENUM ('INCOME', 'EXPENSE');

CREATE TABLE "ManagementAccountingEntry" (
  "id" SERIAL PRIMARY KEY,
  "businessDate" TIMESTAMP(3) NOT NULL,
  "type" "ManagementAccountingEntryType" NOT NULL,
  "category" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "comment" TEXT,
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ManagementAccountingEntry_businessDate_idx"
  ON "ManagementAccountingEntry" ("businessDate");

CREATE INDEX "ManagementAccountingEntry_businessDate_type_idx"
  ON "ManagementAccountingEntry" ("businessDate", "type");
