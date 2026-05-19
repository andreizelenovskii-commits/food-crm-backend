ALTER TABLE "TechnologicalCard"
  ALTER COLUMN "outputQuantity" TYPE DOUBLE PRECISION
  USING "outputQuantity"::DOUBLE PRECISION;
