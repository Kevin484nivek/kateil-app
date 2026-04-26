ALTER TABLE "StorageIntegrationSetting"
ADD COLUMN "oauthAccessToken" TEXT,
ADD COLUMN "oauthRefreshToken" TEXT,
ADD COLUMN "oauthScope" TEXT,
ADD COLUMN "oauthTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN "lastError" TEXT;
