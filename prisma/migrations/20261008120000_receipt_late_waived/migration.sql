-- Receipts: record the late fee waived when collecting, instead of only noting it in the remarks.

-- AlterTable
ALTER TABLE "FeeReceipt" ADD COLUMN     "lateWaived" INTEGER NOT NULL DEFAULT 0;

-- Earlier receipts noted it in the remarks as "Late fee ₹1,200 waived by …": move it into the column.
UPDATE "FeeReceipt"
SET "lateWaived" = CAST(REPLACE(substring("remarks" from 'Late fee ₹([0-9,]+) waived'), ',', '') AS INTEGER),
    "remarks" = NULLIF(regexp_replace("remarks", '( · )?Late fee ₹[0-9,]+ waived by [^·]*', ''), '')
WHERE "remarks" ~ 'Late fee ₹[0-9,]+ waived';
