-- CreateEnum
CREATE TYPE "EmployeeAdjustmentType" AS ENUM ('ADVANCE', 'FINE', 'DEBT');

-- CreateTable
CREATE TABLE "EmployeeAdjustment" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "type" "EmployeeAdjustmentType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeAdjustment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EmployeeAdjustment" ADD CONSTRAINT "EmployeeAdjustment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
