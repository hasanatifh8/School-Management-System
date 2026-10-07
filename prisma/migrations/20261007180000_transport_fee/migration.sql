-- Fees: a fee whose amount is each student's transport stop fare.

-- AlterTable
ALTER TABLE "FeeHead" ADD COLUMN     "transport" BOOLEAN NOT NULL DEFAULT false;
