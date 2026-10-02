-- Fees: a late fee per fee head, and the late fee collected on each receipt line.

-- AlterTable
ALTER TABLE "FeeHead" ADD COLUMN     "lateFee" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "FeeReceiptItem" ADD COLUMN     "lateFee" INTEGER NOT NULL DEFAULT 0;

