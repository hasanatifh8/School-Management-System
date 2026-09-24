-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('UPCOMING', 'CURRENT', 'CLOSED');

-- CreateEnum
CREATE TYPE "EnrollmentResult" AS ENUM ('PROMOTED', 'DETAINED', 'LEFT', 'PASSED_OUT');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "rollNumber" INTEGER;

-- CreateTable
CREATE TABLE "AcademicSession" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'UPCOMING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademicSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "rollNumber" INTEGER,
    "result" "EnrollmentResult",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AcademicSession_schoolId_name_key" ON "AcademicSession"("schoolId", "name");

-- CreateIndex
CREATE INDEX "Enrollment_sectionId_idx" ON "Enrollment"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_sessionId_studentId_key" ON "Enrollment"("sessionId", "studentId");

-- AddForeignKey
ALTER TABLE "AcademicSession" ADD CONSTRAINT "AcademicSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Data: create the current academic session (April–March) for every school,
-- based on the date this migration runs, e.g. 24 Sep 2026 → "2026-27".
INSERT INTO "AcademicSession" ("id", "schoolId", "name", "startDate", "endDate", "status")
SELECT
  gen_random_uuid()::text,
  s."id",
  y.start_year || '-' || lpad(((y.start_year + 1) % 100)::text, 2, '0'),
  make_date(y.start_year, 4, 1),
  make_date(y.start_year + 1, 3, 31),
  'CURRENT'
FROM "School" s
CROSS JOIN (
  SELECT CASE WHEN extract(month FROM now()) >= 4
              THEN extract(year FROM now())::int
              ELSE extract(year FROM now())::int - 1 END AS start_year
) y;

-- Data: place every student who has a class into the current session.
INSERT INTO "Enrollment" ("id", "sessionId", "studentId", "sectionId")
SELECT gen_random_uuid()::text, a."id", st."id", st."sectionId"
FROM "Student" st
JOIN "AcademicSession" a ON a."schoolId" = st."schoolId" AND a."status" = 'CURRENT'
WHERE st."sectionId" IS NOT NULL;
