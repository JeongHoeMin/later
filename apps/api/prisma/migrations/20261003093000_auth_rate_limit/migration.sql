BEGIN;
CREATE TABLE "AuthRateLimitBucket" (
    "key" CHAR(64) NOT NULL,
    "hits" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuthRateLimitBucket_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "AuthRateLimitBucket_expiresAt_idx" ON "AuthRateLimitBucket"("expiresAt");
COMMIT;
