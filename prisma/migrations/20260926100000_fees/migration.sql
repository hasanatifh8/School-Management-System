-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('ADMIN', 'ACCOUNTANT');

-- CreateEnum
CREATE TYPE "FeeFrequency" AS ENUM ('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'UPI', 'CARD', 'CHEQUE', 'BANK_TRANSFER', 'OTHER');

-- AlterTable
ALTER TABLE "SchoolAdmin" ADD COLUMN     "role" "StaffRole" NOT NULL DEFAULT 'ADMIN';

-- CreateTable
CREATE TABLE "FeeHead" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" "FeeFrequency" NOT NULL,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "dueDay" INTEGER NOT NULL DEFAULT 10,
    "dueMonth" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeHead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeAmount" (
    "headId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "FeeAmount_pkey" PRIMARY KEY ("headId","classId")
);

-- CreateTable
CREATE TABLE "StudentFeeHead" (
    "studentId" TEXT NOT NULL,
    "headId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentFeeHead_pkey" PRIMARY KEY ("studentId","headId")
);

-- CreateTable
CREATE TABLE "FeeReceipt" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT,
    "number" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "reference" TEXT,
    "remarks" TEXT,
    "total" INTEGER NOT NULL,
    "studentName" TEXT NOT NULL,
    "studentCode" TEXT NOT NULL,
    "className" TEXT,
    "collectedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancelReason" TEXT,

    CONSTRAINT "FeeReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeReceiptItem" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "headId" TEXT,
    "headName" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "FeeReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeeHead_schoolId_idx" ON "FeeHead"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeHead_sessionId_name_key" ON "FeeHead"("sessionId", "name");

-- CreateIndex
CREATE INDEX "StudentFeeHead_headId_idx" ON "StudentFeeHead"("headId");

-- CreateIndex
CREATE INDEX "FeeReceipt_studentId_idx" ON "FeeReceipt"("studentId");

-- CreateIndex
CREATE INDEX "FeeReceipt_schoolId_date_idx" ON "FeeReceipt"("schoolId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FeeReceipt_schoolId_number_key" ON "FeeReceipt"("schoolId", "number");

-- CreateIndex
CREATE INDEX "FeeReceiptItem_receiptId_idx" ON "FeeReceiptItem"("receiptId");

-- CreateIndex
CREATE INDEX "FeeReceiptItem_headId_period_idx" ON "FeeReceiptItem"("headId", "period");

-- AddForeignKey
ALTER TABLE "FeeHead" ADD CONSTRAINT "FeeHead_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeHead" ADD CONSTRAINT "FeeHead_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAmount" ADD CONSTRAINT "FeeAmount_headId_fkey" FOREIGN KEY ("headId") REFERENCES "FeeHead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAmount" ADD CONSTRAINT "FeeAmount_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeHead" ADD CONSTRAINT "StudentFeeHead_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeHead" ADD CONSTRAINT "StudentFeeHead_headId_fkey" FOREIGN KEY ("headId") REFERENCES "FeeHead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeReceipt" ADD CONSTRAINT "FeeReceipt_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeReceipt" ADD CONSTRAINT "FeeReceipt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeReceipt" ADD CONSTRAINT "FeeReceipt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeReceiptItem" ADD CONSTRAINT "FeeReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "FeeReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeReceiptItem" ADD CONSTRAINT "FeeReceiptItem_headId_fkey" FOREIGN KEY ("headId") REFERENCES "FeeHead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

