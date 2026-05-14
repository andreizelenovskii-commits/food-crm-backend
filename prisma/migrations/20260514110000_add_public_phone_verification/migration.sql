CREATE TABLE "PhoneVerificationCode" (
  "id" SERIAL NOT NULL,
  "phone" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PhoneVerificationCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PhoneVerificationCode_phone_purpose_createdAt_idx"
ON "PhoneVerificationCode"("phone", "purpose", "createdAt");
