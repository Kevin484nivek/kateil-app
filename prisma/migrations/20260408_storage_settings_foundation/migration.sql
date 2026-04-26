CREATE TYPE "StorageProvider" AS ENUM ('GOOGLE_DRIVE');
CREATE TYPE "StorageConnectionStatus" AS ENUM ('NOT_CONNECTED', 'PENDING', 'CONNECTED', 'ERROR');
CREATE TYPE "StorageFolderType" AS ENUM ('BACKUPS', 'INVENTORY_ATTACHMENTS', 'SUPPLIER_ATTACHMENTS');

CREATE TABLE "StorageIntegrationSetting" (
  "id" TEXT NOT NULL,
  "provider" "StorageProvider" NOT NULL DEFAULT 'GOOGLE_DRIVE',
  "status" "StorageConnectionStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
  "connectedAccountEmail" TEXT,
  "rootFolderName" TEXT,
  "rootFolderId" TEXT,
  "rootFolderUrl" TEXT,
  "notes" TEXT,
  "lastValidatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StorageIntegrationSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StorageFolderSetting" (
  "id" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "folderType" "StorageFolderType" NOT NULL,
  "folderName" TEXT NOT NULL,
  "folderId" TEXT,
  "folderUrl" TEXT,
  "status" "StorageConnectionStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
  "lastCheckedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StorageFolderSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StorageFolderSetting_integrationId_folderType_key" ON "StorageFolderSetting"("integrationId", "folderType");

ALTER TABLE "StorageFolderSetting"
ADD CONSTRAINT "StorageFolderSetting_integrationId_fkey"
FOREIGN KEY ("integrationId") REFERENCES "StorageIntegrationSetting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
