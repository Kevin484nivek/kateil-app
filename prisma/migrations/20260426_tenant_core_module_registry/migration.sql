-- CreateEnum
CREATE TYPE "OrganizationMembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "OrganizationModuleKey" AS ENUM (
  'CATALOG_CORE',
  'STOCK_CORE',
  'SALES_CORE',
  'MERCHANDISE_CORE',
  'SEARCH_CORE',
  'CUSTOMERS_PLUS',
  'SUPPLIERS_PLUS',
  'INVENTORY_PLUS',
  'EXPENSES_PLUS',
  'ANALYTICS_PLUS'
);

-- CreateTable
CREATE TABLE "Organization" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "OrganizationMembershipRole" NOT NULL DEFAULT 'MEMBER',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationModule" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "moduleKey" "OrganizationModuleKey" NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationModule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "OrganizationMembership_userId_idx" ON "OrganizationMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_organizationId_userId_key"
ON "OrganizationMembership"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationModule_organizationId_moduleKey_key"
ON "OrganizationModule"("organizationId", "moduleKey");

-- AddForeignKey
ALTER TABLE "OrganizationMembership"
ADD CONSTRAINT "OrganizationMembership_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership"
ADD CONSTRAINT "OrganizationMembership_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationModule"
ADD CONSTRAINT "OrganizationModule_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Bootstrap initial organization and memberships for existing users.
WITH created_org AS (
  INSERT INTO "Organization" ("id", "slug", "name", "isActive", "createdAt", "updatedAt")
  SELECT
    'org_kateil_base',
    'kateil-base',
    'Kateil Base',
    true,
    NOW(),
    NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM "Organization" WHERE "slug" = 'kateil-base'
  )
  RETURNING "id"
),
resolved_org AS (
  SELECT "id" FROM created_org
  UNION ALL
  SELECT "id" FROM "Organization" WHERE "slug" = 'kateil-base' LIMIT 1
)
INSERT INTO "OrganizationMembership"
  ("id", "organizationId", "userId", "role", "isActive", "createdAt", "updatedAt")
SELECT
  'mem_' || u."id",
  ro."id",
  u."id",
  CASE
    WHEN u."role" = 'SUPERADMIN' THEN 'OWNER'::"OrganizationMembershipRole"
    WHEN u."role" = 'ADMIN' THEN 'ADMIN'::"OrganizationMembershipRole"
    ELSE 'MEMBER'::"OrganizationMembershipRole"
  END,
  true,
  NOW(),
  NOW()
FROM "User" u
CROSS JOIN resolved_org ro
ON CONFLICT ("organizationId", "userId") DO NOTHING;

-- Enable all initial modules for existing organizations.
INSERT INTO "OrganizationModule"
  ("id", "organizationId", "moduleKey", "isEnabled", "createdAt", "updatedAt")
SELECT
  'mod_' || o."id" || '_' || m.module_key,
  o."id",
  m.module_key::"OrganizationModuleKey",
  true,
  NOW(),
  NOW()
FROM "Organization" o
CROSS JOIN (
  VALUES
    ('CATALOG_CORE'),
    ('STOCK_CORE'),
    ('SALES_CORE'),
    ('MERCHANDISE_CORE'),
    ('SEARCH_CORE'),
    ('CUSTOMERS_PLUS'),
    ('SUPPLIERS_PLUS'),
    ('INVENTORY_PLUS'),
    ('EXPENSES_PLUS'),
    ('ANALYTICS_PLUS')
) AS m(module_key)
ON CONFLICT ("organizationId", "moduleKey") DO NOTHING;
