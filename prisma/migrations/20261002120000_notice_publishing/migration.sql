-- Notices: publish and expiry dates, attachments, and teachers/staff as recipients.

-- AlterTable
ALTER TABLE "Notice" ADD COLUMN     "expiresOn" DATE,
ADD COLUMN     "forStaff" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "forTeachers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publishAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "NoticeRecipient" ADD COLUMN     "staffId" TEXT,
ADD COLUMN     "teacherId" TEXT;

-- CreateTable
CREATE TABLE "NoticeAttachment" (
    "noticeId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "NoticeAttachment_pkey" PRIMARY KEY ("noticeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "NoticeAttachment_token_key" ON "NoticeAttachment"("token");

-- CreateIndex
CREATE INDEX "Notice_publishAt_idx" ON "Notice"("publishAt");

-- AddForeignKey
ALTER TABLE "NoticeAttachment" ADD CONSTRAINT "NoticeAttachment_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeRecipient" ADD CONSTRAINT "NoticeRecipient_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeRecipient" ADD CONSTRAINT "NoticeRecipient_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Notices sent before this were published when they were sent.
UPDATE "Notice" SET "publishAt" = "createdAt";
