ALTER TABLE "Order"
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'ADMIN',
ADD COLUMN "customerPhoneSnapshot" TEXT,
ADD COLUMN "deliveryAddressSnapshot" TEXT,
ADD COLUMN "customerComment" TEXT;
