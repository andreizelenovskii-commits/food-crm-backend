CREATE TABLE IF NOT EXISTS "RolePermission" (
  "role" TEXT NOT NULL,
  "permission" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("role", "permission")
);
