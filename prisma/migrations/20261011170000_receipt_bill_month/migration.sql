-- Which bill a receipt was collected on, what it left owing, and per line which
-- month it belongs to and whether it cleared it, so receipts and bills can say so.
ALTER TABLE "FeeReceipt" ADD COLUMN "billMonth" TEXT,
ADD COLUMN "leftOwing" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "leftTo" TEXT;
ALTER TABLE "FeeReceiptItem" ADD COLUMN "month" TEXT,
ADD COLUMN "paidBefore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "cleared" BOOLEAN NOT NULL DEFAULT false;
