CREATE TYPE "ManagementAccountingDayStatus" AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE "ManagementAccountingDay" (
  "id" SERIAL PRIMARY KEY,
  "businessDate" TIMESTAMP(3) NOT NULL UNIQUE,
  "status" "ManagementAccountingDayStatus" NOT NULL,
  "openedByUserId" INTEGER,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedByUserId" INTEGER,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ManagementAccountingDay_status_idx"
  ON "ManagementAccountingDay" ("status");

CREATE INDEX "ManagementAccountingDay_businessDate_status_idx"
  ON "ManagementAccountingDay" ("businessDate", "status");
