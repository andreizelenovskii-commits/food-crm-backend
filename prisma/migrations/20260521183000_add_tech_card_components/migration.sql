CREATE TABLE "TechCardComponent" (
  "id" SERIAL PRIMARY KEY,
  "technologicalCardId" INTEGER NOT NULL,
  "componentTechnologicalCardId" INTEGER NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "TechCardComponent_technologicalCardId_fkey"
    FOREIGN KEY ("technologicalCardId") REFERENCES "TechnologicalCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TechCardComponent_componentTechnologicalCardId_fkey"
    FOREIGN KEY ("componentTechnologicalCardId") REFERENCES "TechnologicalCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TechCardComponent_technologicalCardId_componentTechnologicalCardId_key"
ON "TechCardComponent"("technologicalCardId", "componentTechnologicalCardId");

CREATE INDEX "TechCardComponent_componentTechnologicalCardId_idx"
ON "TechCardComponent"("componentTechnologicalCardId");
