-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "actor" TEXT,
ADD COLUMN     "category" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_schoolId_createdAt_idx" ON "AuditLog"("schoolId", "createdAt");

