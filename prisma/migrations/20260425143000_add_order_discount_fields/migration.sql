ALTER TABLE "Order"
ADD COLUMN "subtotalCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "discountPercent" INTEGER NOT NULL DEFAULT 0;

UPDATE "Order"
SET "subtotalCents" = "totalCents",
    "discountPercent" = 0
WHERE "subtotalCents" = 0;
