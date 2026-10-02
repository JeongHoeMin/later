ALTER TYPE "SocialProvider" ADD VALUE 'apple';

CREATE TABLE "AppleLoginAttempt" (
    "id" UUID NOT NULL,
    "nonceHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AppleLoginAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppleLoginAttempt_expiresAt_idx" ON "AppleLoginAttempt"("expiresAt");
