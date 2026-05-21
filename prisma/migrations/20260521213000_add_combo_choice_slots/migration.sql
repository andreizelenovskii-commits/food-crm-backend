CREATE TABLE "TechCardChoiceSlot" (
  "id" SERIAL PRIMARY KEY,
  "technologicalCardId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "allowedPizzaSizes" TEXT[] NOT NULL DEFAULT '{}',
  "quantity" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "TechCardChoiceSlot_technologicalCardId_fkey"
    FOREIGN KEY ("technologicalCardId") REFERENCES "TechnologicalCard"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "TechCardChoiceSlot_technologicalCardId_idx"
  ON "TechCardChoiceSlot"("technologicalCardId");

CREATE TABLE "OrderItemChoice" (
  "id" SERIAL PRIMARY KEY,
  "orderItemId" INTEGER NOT NULL,
  "choiceSlotId" INTEGER NOT NULL,
  "selectedTechnologicalCardId" INTEGER NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "OrderItemChoice_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrderItemChoice_choiceSlotId_fkey"
    FOREIGN KEY ("choiceSlotId") REFERENCES "TechCardChoiceSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OrderItemChoice_selectedTechnologicalCardId_fkey"
    FOREIGN KEY ("selectedTechnologicalCardId") REFERENCES "TechnologicalCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OrderItemChoice_orderItemId_choiceSlotId_key"
  ON "OrderItemChoice"("orderItemId", "choiceSlotId");

CREATE INDEX "OrderItemChoice_choiceSlotId_idx"
  ON "OrderItemChoice"("choiceSlotId");

CREATE INDEX "OrderItemChoice_selectedTechnologicalCardId_idx"
  ON "OrderItemChoice"("selectedTechnologicalCardId");
