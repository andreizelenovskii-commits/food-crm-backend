DROP INDEX IF EXISTS "TechnologicalCard_name_pizzaSize_rollSize_key";

CREATE UNIQUE INDEX "TechnologicalCard_name_category_pizzaSize_rollSize_key"
ON "TechnologicalCard" (
  LOWER(REGEXP_REPLACE(TRIM("name"), '\s+', ' ', 'g')),
  "category",
  COALESCE("pizzaSize", ''),
  COALESCE("rollSize", '')
);
