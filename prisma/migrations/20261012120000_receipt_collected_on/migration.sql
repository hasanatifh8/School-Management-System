-- Previous dues are settled on their own add-on receipt, tied back to the month
-- that owed them (billMonth), and say which later bill collected them.
ALTER TABLE "FeeReceipt" ADD COLUMN "collectedOn" TEXT;
