ALTER TABLE "TechnologicalCard"
ADD COLUMN "category" TEXT;

UPDATE "TechnologicalCard"
SET "category" = 'Роллы'
WHERE "category" IS NULL;

ALTER TABLE "TechnologicalCard"
ALTER COLUMN "category" SET NOT NULL;
