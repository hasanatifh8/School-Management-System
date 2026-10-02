-- Fees: which fees apply before a mid-session admission, opt-in start months,
-- the price an instalment was paid at, and the admission note on receipts.

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "feesFromHeadIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "StudentFeeHead" ADD COLUMN     "fromDate" DATE;

-- AlterTable
ALTER TABLE "FeeReceipt" ADD COLUMN     "feeNote" TEXT;

-- AlterTable
ALTER TABLE "FeeReceiptItem" ADD COLUMN     "charged" INTEGER NOT NULL DEFAULT 0;


-- Students already on an opt-in fee are charged from the month they were added.
UPDATE "StudentFeeHead" SET "fromDate" = date_trunc('month', "createdAt")::date;
