INSERT INTO "TechCardIngredient" (
  "technologicalCardId",
  "productId",
  "quantity",
  "unit"
)
SELECT
  card_26."id",
  ingredient."productId",
  CASE
    WHEN ingredient."unit" = 'шт' THEN GREATEST(1, ROUND(ingredient."quantity" * 0.85))
    WHEN MOD(ROUND((ingredient."quantity" * 0.85 * 1000)::numeric, 6), 1) = 0
      THEN ROUND((ingredient."quantity" * 0.85 * 1000)::numeric) / 1000
    ELSE ROUND((ingredient."quantity" * 0.85 * 1000 / 10)::numeric) * 10 / 1000
  END,
  ingredient."unit"
FROM "TechnologicalCard" base
INNER JOIN "TechnologicalCard" card_26
  ON LOWER(REGEXP_REPLACE(TRIM(card_26."name"), '\s+', ' ', 'g')) =
    LOWER(REGEXP_REPLACE(TRIM(base."name"), '\s+', ' ', 'g'))
  AND card_26."pizzaSize" = '26 см'
INNER JOIN "TechCardIngredient" ingredient
  ON ingredient."technologicalCardId" = base."id"
WHERE base."category" = 'Пиццы'
  AND base."pizzaSize" = '30 см'
  AND NOT EXISTS (
    SELECT 1
    FROM "TechCardIngredient" existing
    WHERE existing."technologicalCardId" = card_26."id"
  );

INSERT INTO "TechCardIngredient" (
  "technologicalCardId",
  "productId",
  "quantity",
  "unit"
)
SELECT
  card_24."id",
  ingredient."productId",
  CASE
    WHEN ingredient."unit" = 'шт' THEN GREATEST(1, ROUND(ingredient."quantity" * 0.85))
    WHEN MOD(ROUND((ingredient."quantity" * 0.85 * 1000)::numeric, 6), 1) = 0
      THEN ROUND((ingredient."quantity" * 0.85 * 1000)::numeric) / 1000
    ELSE ROUND((ingredient."quantity" * 0.85 * 1000 / 10)::numeric) * 10 / 1000
  END,
  ingredient."unit"
FROM "TechnologicalCard" base
INNER JOIN "TechnologicalCard" card_26
  ON LOWER(REGEXP_REPLACE(TRIM(card_26."name"), '\s+', ' ', 'g')) =
    LOWER(REGEXP_REPLACE(TRIM(base."name"), '\s+', ' ', 'g'))
  AND card_26."pizzaSize" = '26 см'
INNER JOIN "TechnologicalCard" card_24
  ON LOWER(REGEXP_REPLACE(TRIM(card_24."name"), '\s+', ' ', 'g')) =
    LOWER(REGEXP_REPLACE(TRIM(base."name"), '\s+', ' ', 'g'))
  AND card_24."pizzaSize" = '24 см'
INNER JOIN "TechCardIngredient" ingredient
  ON ingredient."technologicalCardId" = card_26."id"
WHERE base."category" = 'Пиццы'
  AND base."pizzaSize" = '30 см'
  AND NOT EXISTS (
    SELECT 1
    FROM "TechCardIngredient" existing
    WHERE existing."technologicalCardId" = card_24."id"
  );
