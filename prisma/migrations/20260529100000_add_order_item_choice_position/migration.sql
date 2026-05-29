ALTER TABLE "OrderItemChoice"
  ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS "OrderItemChoice_orderItemId_choiceSlotId_key";

CREATE UNIQUE INDEX "OrderItemChoice_orderItemId_choiceSlotId_position_key"
  ON "OrderItemChoice"("orderItemId", "choiceSlotId", "position");
