-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('WHATSAPP', 'SMS');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "MessagingSettings" (
    "schoolId" TEXT NOT NULL,
    "whatsappProvider" TEXT,
    "whatsappConfig" TEXT,
    "smsProvider" TEXT,
    "smsConfig" TEXT,
    "teachersCanSend" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingSettings_pkey" PRIMARY KEY ("schoolId")
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channels" "MessageChannel"[],
    "audience" TEXT NOT NULL,
    "sentBy" TEXT NOT NULL,
    "teacherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoticeRecipient" (
    "id" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "studentId" TEXT,
    "name" TEXT NOT NULL,
    "className" TEXT,
    "phone" TEXT,
    "channel" "MessageChannel" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "providerRef" TEXT,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "NoticeRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notice_schoolId_createdAt_idx" ON "Notice"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "NoticeRecipient_noticeId_status_idx" ON "NoticeRecipient"("noticeId", "status");

-- CreateIndex
CREATE INDEX "NoticeRecipient_studentId_idx" ON "NoticeRecipient"("studentId");

-- AddForeignKey
ALTER TABLE "MessagingSettings" ADD CONSTRAINT "MessagingSettings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeRecipient" ADD CONSTRAINT "NoticeRecipient_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeRecipient" ADD CONSTRAINT "NoticeRecipient_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

