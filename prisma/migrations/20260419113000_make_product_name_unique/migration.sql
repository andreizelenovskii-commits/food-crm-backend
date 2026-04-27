CREATE UNIQUE INDEX IF NOT EXISTS "Product_name_lower_key"
ON "Product" (LOWER("name"));
