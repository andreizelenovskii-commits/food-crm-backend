ALTER TABLE "Order"
ADD COLUMN "clientNameSnapshot" TEXT,
ADD COLUMN "clientTypeSnapshot" "ClientType";

UPDATE "Order" o
SET
  "clientNameSnapshot" = c."name",
  "clientTypeSnapshot" = c."type"
FROM "Client" c
WHERE o."clientId" = c."id";

ALTER TABLE "Order"
ALTER COLUMN "clientNameSnapshot" SET NOT NULL,
ALTER COLUMN "clientTypeSnapshot" SET NOT NULL;

ALTER TABLE "Order"
DROP CONSTRAINT "Order_clientId_fkey";

ALTER TABLE "Order"
ALTER COLUMN "clientId" DROP NOT NULL;

ALTER TABLE "Order"
ADD CONSTRAINT "Order_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
