-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('OWNED', 'CONSIGNMENT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'BIZUM');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('INITIAL', 'ENTRY', 'SALE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ReferenceType" AS ENUM ('PRODUCT', 'SALE', 'INVENTORY_ENTRY', 'MANUAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "defaultStoreCommissionPct" DECIMAL(5,2),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "size" TEXT,
    "color" TEXT,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "cost" DECIMAL(10,2) NOT NULL,
    "stockCurrent" INTEGER NOT NULL DEFAULT 0,
    "productType" "ProductType" NOT NULL,
    "supplierId" TEXT NOT NULL,
    "storeCommissionPct" DECIMAL(5,2),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "saleNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT,
    "userId" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleLine" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "soldUnitPrice" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "productTypeSnapshot" "ProductType" NOT NULL,
    "storeCommissionPctSnapshot" DECIMAL(5,2),
    "storeAmount" DECIMAL(10,2) NOT NULL,
    "supplierAmount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "SaleLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryEntry" (
    "id" TEXT NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryEntryLine" (
    "id" TEXT NOT NULL,
    "inventoryEntryId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "InventoryEntryLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "referenceType" "ReferenceType" NOT NULL,
    "referenceId" TEXT,
    "quantityDelta" INTEGER NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_saleNumber_key" ON "Sale"("saleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryEntry_entryNumber_key" ON "InventoryEntry"("entryNumber");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEntry" ADD CONSTRAINT "InventoryEntry_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEntry" ADD CONSTRAINT "InventoryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEntryLine" ADD CONSTRAINT "InventoryEntryLine_inventoryEntryId_fkey" FOREIGN KEY ("inventoryEntryId") REFERENCES "InventoryEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEntryLine" ADD CONSTRAINT "InventoryEntryLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
