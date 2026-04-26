CREATE TYPE "SaleKind" AS ENUM ('NORMAL', 'RETURN_EXCHANGE');

ALTER TABLE "Sale"
ADD COLUMN "saleKind" "SaleKind" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN "originalSaleId" TEXT,
ADD COLUMN "saleItemsTotalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "returnTotalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

UPDATE "Sale"
SET "saleItemsTotalAmount" = "totalAmount",
    "returnTotalAmount" = 0
WHERE "saleKind" = 'NORMAL';

ALTER TABLE "Sale"
ADD CONSTRAINT "Sale_originalSaleId_fkey"
FOREIGN KEY ("originalSaleId") REFERENCES "Sale"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Sale_originalSaleId_idx" ON "Sale"("originalSaleId");

CREATE TABLE "SaleReturnLine" (
  "id" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "originalSaleLineId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "refundedUnitPrice" DECIMAL(10,2) NOT NULL,
  "subtotal" DECIMAL(10,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SaleReturnLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SaleReturnLine_saleId_idx" ON "SaleReturnLine"("saleId");
CREATE INDEX "SaleReturnLine_originalSaleLineId_idx" ON "SaleReturnLine"("originalSaleLineId");
CREATE INDEX "SaleReturnLine_productId_idx" ON "SaleReturnLine"("productId");

ALTER TABLE "SaleReturnLine"
ADD CONSTRAINT "SaleReturnLine_saleId_fkey"
FOREIGN KEY ("saleId") REFERENCES "Sale"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SaleReturnLine"
ADD CONSTRAINT "SaleReturnLine_originalSaleLineId_fkey"
FOREIGN KEY ("originalSaleLineId") REFERENCES "SaleLine"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SaleReturnLine"
ADD CONSTRAINT "SaleReturnLine_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
