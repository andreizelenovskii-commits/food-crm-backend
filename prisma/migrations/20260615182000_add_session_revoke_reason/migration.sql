ALTER TABLE "sessions"
  ADD COLUMN IF NOT EXISTS "revokedReason" TEXT;
