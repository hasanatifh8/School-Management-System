-- AlterTable
ALTER TABLE "Student" ADD COLUMN "guardianRelation" TEXT;

-- Students whose guardian is their father.
UPDATE "Student" SET "guardianRelation" = 'Father'
WHERE "guardianName" IS NOT NULL AND "guardianName" = "fatherName";
