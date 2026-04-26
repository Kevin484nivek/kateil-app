-- CreateEnum
CREATE TYPE "SupplierCommercialModel" AS ENUM ('DIRECT_PURCHASE', 'SEASONAL_ORDER', 'CONSIGNMENT');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('OPEN', 'RECEIVED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Supplier"
ADD COLUMN "commercialModel" "SupplierCommercialModel" NOT NULL DEFAULT 'DIRECT_PURCHASE',
ADD COLUMN "contractPdfUrl" TEXT;

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "expectedDate" TIMESTAMP(3),
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_orderNumber_key" ON "PurchaseOrder"("orderNumber");

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
