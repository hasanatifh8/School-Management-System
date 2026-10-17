-- CreateEnum
CREATE TYPE "SalaryComponentKind" AS ENUM ('EARNING', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "SalaryCalc" AS ENUM ('FIXED', 'PERCENT_OF_BASIC');

-- AlterTable
ALTER TABLE "SalaryPayment" ADD COLUMN     "gross" INTEGER,
ADD COLUMN     "lines" JSONB,
ADD COLUMN     "lopAmount" INTEGER,
ADD COLUMN     "lopDays" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "SalaryComponent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SalaryComponentKind" NOT NULL,
    "calc" "SalaryCalc" NOT NULL DEFAULT 'FIXED',
    "defaultValue" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryValue" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "teacherId" TEXT,
    "staffId" TEXT,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SalaryValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalaryComponent_schoolId_name_key" ON "SalaryComponent"("schoolId", "name");

-- CreateIndex
CREATE INDEX "SalaryValue_schoolId_idx" ON "SalaryValue"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryValue_componentId_teacherId_key" ON "SalaryValue"("componentId", "teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryValue_componentId_staffId_key" ON "SalaryValue"("componentId", "staffId");

-- AddForeignKey
ALTER TABLE "SalaryComponent" ADD CONSTRAINT "SalaryComponent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryValue" ADD CONSTRAINT "SalaryValue_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryValue" ADD CONSTRAINT "SalaryValue_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "SalaryComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryValue" ADD CONSTRAINT "SalaryValue_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryValue" ADD CONSTRAINT "SalaryValue_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

