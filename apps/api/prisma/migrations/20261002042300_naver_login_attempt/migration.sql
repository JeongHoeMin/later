CREATE TABLE "NaverLoginAttempt" (
    "id" UUID NOT NULL,
    "stateHash" CHAR(64) NOT NULL,
    "secretHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sealedGrant" TEXT,
    "callbackAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NaverLoginAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NaverLoginAttempt_stateHash_key" ON "NaverLoginAttempt"("stateHash");
CREATE INDEX "NaverLoginAttempt_expiresAt_idx" ON "NaverLoginAttempt"("expiresAt");
