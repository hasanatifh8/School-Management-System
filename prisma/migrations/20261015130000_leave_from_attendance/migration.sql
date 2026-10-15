-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "fromAttendance" BOOLEAN NOT NULL DEFAULT false;

-- Students already marked Leave in attendance without a leave for that day get
-- an approved one-day leave, as saving attendance now does.
INSERT INTO "LeaveRequest" ("id", "schoolId", "applicant", "studentId", "fromDate", "toDate", "category", "description", "status", "requestedBy", "decidedBy", "decidedAt", "createdAt", "updatedAt", "fromAttendance")
SELECT DISTINCT ON (d."schoolId", r."studentId", d."date")
  gen_random_uuid()::text, d."schoolId", 'STUDENT', r."studentId", d."date", d."date", 'OTHER',
  COALESCE(NULLIF(r."remark", ''), 'Marked on leave in attendance'), 'APPROVED',
  COALESCE(d."markedBy", 'Attendance'), COALESCE(d."markedBy", 'Attendance'), d."updatedAt", NOW(), NOW(), true
FROM "AttendanceRecord" r
JOIN "AttendanceDay" d ON d."id" = r."dayId"
WHERE r."status" = 'LEAVE'
  AND NOT EXISTS (
    SELECT 1 FROM "LeaveRequest" l
    WHERE l."studentId" = r."studentId" AND l."status" <> 'REJECTED'
      AND l."fromDate" <= d."date" AND l."toDate" >= d."date"
  );
