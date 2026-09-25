-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "loginEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "username" TEXT;

-- CreateTable
CREATE TABLE "TeacherSession" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherSession_teacherId_idx" ON "TeacherSession"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_username_key" ON "Teacher"("username");

-- AddForeignKey
ALTER TABLE "TeacherSession" ADD CONSTRAINT "TeacherSession_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

