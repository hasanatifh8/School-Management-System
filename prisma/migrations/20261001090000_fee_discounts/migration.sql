-- Discounts given when collecting fees.

-- AlterTable
ALTER TABLE "FeeReceipt" ADD COLUMN     "discountNote" TEXT;

-- AlterTable
ALTER TABLE "FeeReceiptItem" ADD COLUMN     "discount" INTEGER NOT NULL DEFAULT 0;
