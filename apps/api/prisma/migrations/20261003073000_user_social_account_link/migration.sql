-- No rows are deleted. Existing attempts remain login-purpose (NULL owner).
-- Duplicate (userId, provider) rows must be resolved before deployment; unique index creation fails safely otherwise.
BEGIN;
ALTER TABLE "AppleLoginAttempt" ADD COLUMN "ownerUserId" UUID;
ALTER TABLE "NaverLoginAttempt" ADD COLUMN "ownerUserId" UUID;
ALTER TABLE "AppleLoginAttempt" ADD CONSTRAINT "AppleLoginAttempt_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NaverLoginAttempt" ADD CONSTRAINT "NaverLoginAttempt_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "SocialAccount_userId_provider_key" ON "SocialAccount"("userId", "provider");
COMMIT;
