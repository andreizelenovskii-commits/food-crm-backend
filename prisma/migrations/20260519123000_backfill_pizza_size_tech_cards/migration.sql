WITH base_pizzas AS (
  SELECT
    "id",
    "name",
    "category",
    "outputQuantity",
    "outputUnit",
    "description"
  FROM "TechnologicalCard" base
  WHERE base."category" = 'Пиццы'
    AND base."pizzaSize" = '30 см'
),
inserted_26 AS (
  INSERT INTO "TechnologicalCard" (
    "name",
    "category",
    "pizzaSize",
    "outputQuantity",
    "outputUnit",
    "description"
  )
  SELECT
    base."name",
    base."category",
    '26 см',
    base."outputQuantity",
    base."outputUnit",
    base."description"
  FROM base_pizzas base
  WHERE NOT EXISTS (
    SELECT 1
    FROM "TechnologicalCard" existing
    WHERE LOWER(REGEXP_REPLACE(TRIM(existing."name"), '\s+', ' ', 'g')) =
      LOWER(REGEXP_REPLACE(TRIM(base."name"), '\s+', ' ', 'g'))
      AND existing."pizzaSize" = '26 см'
  )
  RETURNING "id", "name"
),
variant_26 AS (
  SELECT
    base."id" AS "baseId",
    card."id" AS "variantId"
  FROM base_pizzas base
  INNER JOIN "TechnologicalCard" card
    ON LOWER(REGEXP_REPLACE(TRIM(card."name"), '\s+', ' ', 'g')) =
      LOWER(REGEXP_REPLACE(TRIM(base."name"), '\s+', ' ', 'g'))
    AND card."pizzaSize" = '26 см'
),
insert_26_ingredients AS (
  INSERT INTO "TechCardIngredient" (
    "technologicalCardId",
    "productId",
    "quantity",
    "unit"
  )
  SELECT
    variant."variantId",
    ingredient."productId",
    CASE
      WHEN ingredient."unit" = 'шт' THEN GREATEST(1, ROUND(ingredient."quantity" * 0.85))
      WHEN MOD(ROUND((ingredient."quantity" * 0.85 * 1000)::numeric, 6), 1) = 0
        THEN ROUND((ingredient."quantity" * 0.85 * 1000)::numeric) / 1000
      ELSE ROUND((ingredient."quantity" * 0.85 * 1000 / 10)::numeric) * 10 / 1000
    END,
    ingredient."unit"
  FROM variant_26 variant
  INNER JOIN "TechCardIngredient" ingredient
    ON ingredient."technologicalCardId" = variant."baseId"
  WHERE NOT EXISTS (
    SELECT 1
    FROM "TechCardIngredient" existing
    WHERE existing."technologicalCardId" = variant."variantId"
  )
),
inserted_24 AS (
  INSERT INTO "TechnologicalCard" (
    "name",
    "category",
    "pizzaSize",
    "outputQuantity",
    "outputUnit",
    "description"
  )
  SELECT
    base."name",
    base."category",
    '24 см',
    base."outputQuantity",
    base."outputUnit",
    base."description"
  FROM base_pizzas base
  WHERE NOT EXISTS (
    SELECT 1
    FROM "TechnologicalCard" existing
    WHERE LOWER(REGEXP_REPLACE(TRIM(existing."name"), '\s+', ' ', 'g')) =
      LOWER(REGEXP_REPLACE(TRIM(base."name"), '\s+', ' ', 'g'))
      AND existing."pizzaSize" = '24 см'
  )
  RETURNING "id", "name"
),
variant_24 AS (
  SELECT
    card_26."id" AS "sourceId",
    card_24."id" AS "variantId"
  FROM base_pizzas base
  INNER JOIN "TechnologicalCard" card_26
    ON LOWER(REGEXP_REPLACE(TRIM(card_26."name"), '\s+', ' ', 'g')) =
      LOWER(REGEXP_REPLACE(TRIM(base."name"), '\s+', ' ', 'g'))
    AND card_26."pizzaSize" = '26 см'
  INNER JOIN "TechnologicalCard" card_24
    ON LOWER(REGEXP_REPLACE(TRIM(card_24."name"), '\s+', ' ', 'g')) =
      LOWER(REGEXP_REPLACE(TRIM(base."name"), '\s+', ' ', 'g'))
    AND card_24."pizzaSize" = '24 см'
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
  CASE
    WHEN ingredient."unit" = 'шт' THEN GREATEST(1, ROUND(ingredient."quantity" * 0.85))
    WHEN MOD(ROUND((ingredient."quantity" * 0.85 * 1000)::numeric, 6), 1) = 0
      THEN ROUND((ingredient."quantity" * 0.85 * 1000)::numeric) / 1000
    ELSE ROUND((ingredient."quantity" * 0.85 * 1000 / 10)::numeric) * 10 / 1000
  END,
  ingredient."unit"
FROM variant_24 variant
INNER JOIN "TechCardIngredient" ingredient
  ON ingredient."technologicalCardId" = variant."sourceId"
WHERE NOT EXISTS (
  SELECT 1
  FROM "TechCardIngredient" existing
  WHERE existing."technologicalCardId" = variant."variantId"
);
