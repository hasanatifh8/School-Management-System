-- A late fee belongs to the month it is charged in: a line can carry a later
-- month's late fee on an earlier fee still unpaid then, kept apart from the
-- instalment's own month so each month's bill shows only its own fines.
ALTER TABLE "FeeReceiptItem" ADD COLUMN "lateMonth" TEXT;
