DROP INDEX IF EXISTS "TechnologicalCard_name_key";

CREATE UNIQUE INDEX "TechnologicalCard_name_pizzaSize_key"
ON "TechnologicalCard" (
  LOWER(REGEXP_REPLACE(TRIM("name"), '\s+', ' ', 'g')),
  COALESCE("pizzaSize", '')
);
