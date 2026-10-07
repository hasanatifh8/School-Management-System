-- Fees: a late fee can repeat for every month an instalment stays unpaid.

-- AlterTable
ALTER TABLE "FeeHead" ADD COLUMN     "lateFeeMonthly" BOOLEAN NOT NULL DEFAULT true;
