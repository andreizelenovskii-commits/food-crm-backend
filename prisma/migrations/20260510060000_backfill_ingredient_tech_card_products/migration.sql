WITH ingredient_cards AS (
  SELECT
    t."name",
    t."outputUnit",
    t."description"
  FROM "TechnologicalCard" t
  WHERE t."category" = 'Ингредиенты'
    AND NOT EXISTS (
      SELECT 1
      FROM "Product" p
      WHERE LOWER(p."name") = LOWER(t."name")
    )
),
numbered_products AS (
  SELECT
    nextval(pg_get_serial_sequence('"Product"', 'id')) AS "id",
    "name",
    "outputUnit",
    "description"
  FROM ingredient_cards
)
INSERT INTO "Product" ("id", "name", "sku", "category", "unit", "stockQuantity", "priceCents", "description", "createdAt")
SELECT
  "id",
  "name",
  CONCAT('PRD-', LPAD("id"::text, 5, '0')),
  'Ингредиенты',
  "outputUnit",
  0,
  0,
  "description",
  NOW()
FROM numbered_products;
