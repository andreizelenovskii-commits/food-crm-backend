ALTER TABLE "TechnologicalCard"
ADD COLUMN IF NOT EXISTS "rollSize" TEXT;

UPDATE "TechnologicalCard"
SET "rollSize" = '8 шт'
WHERE "category" = 'Роллы'
  AND "rollSize" IS NULL;

DROP INDEX IF EXISTS "TechnologicalCard_name_pizzaSize_key";

CREATE UNIQUE INDEX "TechnologicalCard_name_pizzaSize_rollSize_key"
ON "TechnologicalCard" (
  LOWER(REGEXP_REPLACE(TRIM("name"), '\s+', ' ', 'g')),
  COALESCE("pizzaSize", ''),
  COALESCE("rollSize", '')
);

WITH base_rolls AS (
  SELECT
    "id",
    "name",
    "category",
    "outputQuantity",
    "outputUnit",
    "description"
  FROM "TechnologicalCard" base
  WHERE base."category" = 'Роллы'
    AND base."rollSize" = '8 шт'
),
inserted_4 AS (
  INSERT INTO "TechnologicalCard" (
    "name",
    "category",
    "pizzaSize",
    "rollSize",
    "outputQuantity",
    "outputUnit",
    "description"
  )
  SELECT
    base."name",
    base."category",
    NULL,
    '4 шт',
    base."outputQuantity",
    base."outputUnit",
    base."description"
  FROM base_rolls base
  WHERE NOT EXISTS (
    SELECT 1
    FROM "TechnologicalCard" existing
    WHERE LOWER(REGEXP_REPLACE(TRIM(existing."name"), '\s+', ' ', 'g')) =
      LOWER(REGEXP_REPLACE(TRIM(base."name"), '\s+', ' ', 'g'))
      AND existing."rollSize" = '4 шт'
  )
  RETURNING "id", "name"
),
inserted_variant_4 AS (
  SELECT
    base."id" AS "baseId",
    inserted."id" AS "variantId"
  FROM base_rolls base
  INNER JOIN inserted_4 inserted
    ON LOWER(REGEXP_REPLACE(TRIM(inserted."name"), '\s+', ' ', 'g')) =
      LOWER(REGEXP_REPLACE(TRIM(base."name"), '\s+', ' ', 'g'))
),
existing_variant_4 AS (
  SELECT
    base."id" AS "baseId",
    card."id" AS "variantId"
  FROM base_rolls base
  INNER JOIN "TechnologicalCard" card
    ON LOWER(REGEXP_REPLACE(TRIM(card."name"), '\s+', ' ', 'g')) =
      LOWER(REGEXP_REPLACE(TRIM(base."name"), '\s+', ' ', 'g'))
    AND card."rollSize" = '4 шт'
),
variant_4 AS (
  SELECT
    "baseId",
    "variantId"
  FROM inserted_variant_4
  UNION
  SELECT
    "baseId",
    "variantId"
  FROM existing_variant_4
)
INSERT INTO "TechCardIngredient" (
  "technologicalCardId",
  "productId",
  "quantity",
  "unit"
)
SELECT
  variant."variantId",
  ingredient."productId",
  GREATEST(0.001, ROUND((ingredient."quantity" * 0.5 * 1000)::numeric) / 1000),
  ingredient."unit"
FROM variant_4 variant
INNER JOIN "TechCardIngredient" ingredient
  ON ingredient."technologicalCardId" = variant."baseId"
WHERE NOT EXISTS (
  SELECT 1
  FROM "TechCardIngredient" existing
  WHERE existing."technologicalCardId" = variant."variantId"
);
