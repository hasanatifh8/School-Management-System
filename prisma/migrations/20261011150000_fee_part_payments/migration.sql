-- Part payments keep the late fee owing: it is fixed on the instalment when billed.
ALTER TABLE "FeeReceipt" ADD COLUMN "waiver" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FeeReceiptItem" ADD COLUMN "lateCharged" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lateWaived" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lateMonths" INTEGER NOT NULL DEFAULT 0;

-- Earlier receipts took the late fee in full, once, and no late fee followed it.
UPDATE "FeeReceiptItem" SET "lateCharged" = "lateFee", "lateMonths" = 120 WHERE "lateFee" > 0;
