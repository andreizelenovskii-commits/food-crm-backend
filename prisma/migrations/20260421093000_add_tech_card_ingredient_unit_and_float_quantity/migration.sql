ALTER TABLE "TechCardIngredient"
ALTER COLUMN "quantity" TYPE DOUBLE PRECISION
USING "quantity"::DOUBLE PRECISION;

ALTER TABLE "TechCardIngredient"
ADD COLUMN "unit" TEXT;

UPDATE "TechCardIngredient" i
SET "unit" = CASE
  WHEN p."unit" IN ('кг', 'шт') THEN p."unit"
  ELSE 'шт'
END
FROM "Product" p
WHERE p."id" = i."productId";

UPDATE "TechCardIngredient"
SET "unit" = 'шт'
WHERE "unit" IS NULL;

ALTER TABLE "TechCardIngredient"
ALTER COLUMN "unit" SET NOT NULL;
