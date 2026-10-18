-- AlterEnum
ALTER TYPE "LeaveCategory" ADD VALUE 'PRIVILEGED';

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "leavePolicyId" TEXT;

-- AlterTable
ALTER TABLE "StaffMember" ADD COLUMN     "leavePolicyId" TEXT;

-- CreateTable
CREATE TABLE "LeavePolicy" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "days" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveExtra" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "teacherId" TEXT,
    "staffId" TEXT,
    "category" "LeaveCategory" NOT NULL,
    "days" INTEGER NOT NULL,

    CONSTRAINT "LeaveExtra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeavePolicy_schoolId_name_key" ON "LeavePolicy"("schoolId", "name");

-- CreateIndex
CREATE INDEX "LeaveExtra_schoolId_idx" ON "LeaveExtra"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveExtra_sessionId_teacherId_category_key" ON "LeaveExtra"("sessionId", "teacherId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveExtra_sessionId_staffId_category_key" ON "LeaveExtra"("sessionId", "staffId", "category");

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_leavePolicyId_fkey" FOREIGN KEY ("leavePolicyId") REFERENCES "LeavePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeavePolicy" ADD CONSTRAINT "LeavePolicy_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveExtra" ADD CONSTRAINT "LeaveExtra_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveExtra" ADD CONSTRAINT "LeaveExtra_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveExtra" ADD CONSTRAINT "LeaveExtra_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveExtra" ADD CONSTRAINT "LeaveExtra_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_leavePolicyId_fkey" FOREIGN KEY ("leavePolicyId") REFERENCES "LeavePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

