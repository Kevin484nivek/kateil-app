CREATE TYPE "ConsignmentSettlementMode" AS ENUM ('PERCENT_COMMISSION', 'FIXED_COST');

ALTER TABLE "Supplier"
ADD COLUMN "consignmentSettlementMode" "ConsignmentSettlementMode" NOT NULL DEFAULT 'PERCENT_COMMISSION';

UPDATE "Supplier"
SET "consignmentSettlementMode" = 'FIXED_COST'
WHERE lower("name") LIKE 'erika%'
   OR lower("name") LIKE 'ericka%';
