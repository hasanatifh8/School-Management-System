-- Attendance and leave tools: Late for staff, leave allowances and attachments,
-- a log of attendance changes made from registers, and proxy (substitute) teachers.
-- AlterEnum
ALTER TYPE "StaffAttendanceStatus" ADD VALUE 'LATE';

-- CreateTable
CREATE TABLE "LeaveAttachment" (
    "leaveId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "LeaveAttachment_pkey" PRIMARY KEY ("leaveId")
);

-- CreateTable
CREATE TABLE "LeaveAllowance" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "applicant" "LeaveApplicant" NOT NULL,
    "category" "LeaveCategory" NOT NULL,
    "days" INTEGER NOT NULL,

    CONSTRAINT "LeaveAllowance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceChange" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "studentId" TEXT,
    "teacherId" TEXT,
    "staffId" TEXT,
    "personName" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProxyAssignment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "slotId" TEXT NOT NULL,
    "absentTeacherId" TEXT NOT NULL,
    "proxyTeacherId" TEXT NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProxyAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeaveAllowance_schoolId_applicant_category_key" ON "LeaveAllowance"("schoolId", "applicant", "category");

-- CreateIndex
CREATE INDEX "AttendanceChange_schoolId_date_idx" ON "AttendanceChange"("schoolId", "date");

-- CreateIndex
CREATE INDEX "ProxyAssignment_schoolId_date_idx" ON "ProxyAssignment"("schoolId", "date");

-- CreateIndex
CREATE INDEX "ProxyAssignment_proxyTeacherId_date_idx" ON "ProxyAssignment"("proxyTeacherId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ProxyAssignment_slotId_date_key" ON "ProxyAssignment"("slotId", "date");

-- AddForeignKey
ALTER TABLE "LeaveAttachment" ADD CONSTRAINT "LeaveAttachment_leaveId_fkey" FOREIGN KEY ("leaveId") REFERENCES "LeaveRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveAllowance" ADD CONSTRAINT "LeaveAllowance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceChange" ADD CONSTRAINT "AttendanceChange_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProxyAssignment" ADD CONSTRAINT "ProxyAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProxyAssignment" ADD CONSTRAINT "ProxyAssignment_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "TimetableSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProxyAssignment" ADD CONSTRAINT "ProxyAssignment_absentTeacherId_fkey" FOREIGN KEY ("absentTeacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProxyAssignment" ADD CONSTRAINT "ProxyAssignment_proxyTeacherId_fkey" FOREIGN KEY ("proxyTeacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

