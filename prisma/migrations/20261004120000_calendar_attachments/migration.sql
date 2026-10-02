-- Calendar entries: an optional attachment (PDF, PNG or JPG).

-- CreateTable
CREATE TABLE "CalendarAttachment" (
    "eventId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarAttachment_pkey" PRIMARY KEY ("eventId")
);

-- AddForeignKey
ALTER TABLE "CalendarAttachment" ADD CONSTRAINT "CalendarAttachment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

