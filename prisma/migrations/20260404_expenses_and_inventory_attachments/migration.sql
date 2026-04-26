-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM (
  'RENT',
  'SELF_EMPLOYED',
  'ELECTRICITY',
  'INTERNET',
  'SECURITY',
  'POS',
  'ACCOUNTING',
  'SUPPLIES',
  'MARKETING',
  'MERCHANDISE',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "ExpenseSourceType" AS ENUM ('MANUAL', 'RECURRING', 'INVENTORY_ENTRY');

-- AlterTable
ALTER TABLE "InventoryEntry" ADD COLUMN "attachmentUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN "attachmentUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "RecurringExpenseRule" (
  "id" TEXT NOT NULL,
  "category" "ExpenseCategory" NOT NULL,
  "concept" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "notes" TEXT,
  "startYear" INTEGER NOT NULL,
  "startMonth" INTEGER NOT NULL,
  "endYear" INTEGER,
  "endMonth" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RecurringExpenseRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
  "id" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "category" "ExpenseCategory" NOT NULL,
  "concept" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "notes" TEXT,
  "sourceType" "ExpenseSourceType" NOT NULL DEFAULT 'MANUAL',
  "sourceReferenceId" TEXT,
  "recurringRuleId" TEXT,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_year_month_idx" ON "Expense"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_recurringRuleId_year_month_key" ON "Expense"("recurringRuleId", "year", "month");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recurringRuleId_fkey" FOREIGN KEY ("recurringRuleId") REFERENCES "RecurringExpenseRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
