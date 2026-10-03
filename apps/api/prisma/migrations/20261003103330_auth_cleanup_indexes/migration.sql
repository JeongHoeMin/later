-- Add indexes without changing or removing existing rows.
-- Standard CREATE INDEX may block writes while building; schedule production application accordingly.
CREATE INDEX "AuthSession_expiresAt_id_idx" ON "AuthSession"("expiresAt", "id");
CREATE INDEX "AppleLoginAttempt_ownerUserId_idx" ON "AppleLoginAttempt"("ownerUserId");
CREATE INDEX "NaverLoginAttempt_ownerUserId_idx" ON "NaverLoginAttempt"("ownerUserId");
