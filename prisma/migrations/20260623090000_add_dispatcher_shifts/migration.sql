ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'NEW' BEFORE 'SENT_TO_KITCHEN';

CREATE TYPE "DispatcherShiftStatus" AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE "DispatcherShift" (
  "id" SERIAL NOT NULL,
  "number" INTEGER NOT NULL,
  "businessDate" TIMESTAMP(3) NOT NULL,
  "status" "DispatcherShiftStatus" NOT NULL,
  "timeZone" TEXT NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3),
  "responsibleName" TEXT NOT NULL,
  "closedByName" TEXT,
  "openedByUserId" INTEGER NOT NULL,
  "closedByUserId" INTEGER,
  "checksCountSnapshot" INTEGER,
  "revenueCentsSnapshot" INTEGER,
  "cancelledOrdersSnapshot" INTEGER,
  "totalOrdersSnapshot" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DispatcherShift_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order" ADD COLUMN "shiftId" INTEGER;
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'NEW';

CREATE UNIQUE INDEX "DispatcherShift_number_key" ON "DispatcherShift"("number");
CREATE UNIQUE INDEX "DispatcherShift_businessDate_key" ON "DispatcherShift"("businessDate");
CREATE UNIQUE INDEX "DispatcherShift_single_open_idx" ON "DispatcherShift"("status") WHERE "status" = 'OPEN';
CREATE INDEX "DispatcherShift_status_idx" ON "DispatcherShift"("status");
CREATE INDEX "DispatcherShift_businessDate_idx" ON "DispatcherShift"("businessDate");
CREATE INDEX "Order_shiftId_idx" ON "Order"("shiftId");
CREATE INDEX "Order_shiftId_status_idx" ON "Order"("shiftId", "status");

ALTER TABLE "DispatcherShift"
  ADD CONSTRAINT "DispatcherShift_openedByUserId_fkey"
  FOREIGN KEY ("openedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DispatcherShift"
  ADD CONSTRAINT "DispatcherShift_closedByUserId_fkey"
  FOREIGN KEY ("closedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_shiftId_fkey"
  FOREIGN KEY ("shiftId") REFERENCES "DispatcherShift"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
