-- AlterTable
ALTER TABLE "Supplier"
ADD COLUMN "supportsConsignment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "supportsDirectPurchase" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "supportsSeasonalOrder" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing values
UPDATE "Supplier"
SET
  "supportsDirectPurchase" = CASE WHEN "commercialModel" = 'DIRECT_PURCHASE' THEN true ELSE false END,
  "supportsSeasonalOrder" = CASE WHEN "commercialModel" = 'SEASONAL_ORDER' THEN true ELSE false END,
  "supportsConsignment" = CASE WHEN "commercialModel" = 'CONSIGNMENT' THEN true ELSE false END;

-- Drop old enum column
ALTER TABLE "Supplier" DROP COLUMN "commercialModel";

-- DropEnum
DROP TYPE "SupplierCommercialModel";
