-- Staff profiles like teachers (ID, photo, personal and contact details,
-- qualification, documents), and cashiers made from staff members.

-- AlterTable
ALTER TABLE "StaffMember" ADD COLUMN     "address" TEXT,
ADD COLUMN     "bloodGroup" "BloodGroup",
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "email" TEXT,
ADD COLUMN     "employeeCode" TEXT,
ADD COLUMN     "experienceYears" INTEGER,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "photoId" TEXT,
ADD COLUMN     "qualification" TEXT,
ADD COLUMN     "whatsappNumber" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "staffMemberId" TEXT;

-- AlterTable
ALTER TABLE "SchoolAdmin" ADD COLUMN     "staffMemberId" TEXT;

-- Every existing fees login becomes a staff member (job "Cashier") linked to it,
-- so cashiers are always staff members.
INSERT INTO "StaffMember" ("id", "schoolId", "name", "designation", "email", "status", "createdAt", "updatedAt")
SELECT 'cashier_' || a."id", a."schoolId", a."name", 'Cashier', a."email",
       CASE WHEN a."active" THEN 'ACTIVE'::"Status" ELSE 'INACTIVE'::"Status" END, a."createdAt", CURRENT_TIMESTAMP
FROM "SchoolAdmin" a
WHERE a."role" = 'ACCOUNTANT';

UPDATE "SchoolAdmin" SET "staffMemberId" = 'cashier_' || "id" WHERE "role" = 'ACCOUNTANT';

-- Staff IDs (STF-0001…) in the order people were added, per school.
UPDATE "StaffMember" s
SET "employeeCode" = 'STF-' || LPAD(n.rn::TEXT, 4, '0')
FROM (SELECT "id", ROW_NUMBER() OVER (PARTITION BY "schoolId" ORDER BY "createdAt", "id") AS rn FROM "StaffMember") n
WHERE s."id" = n."id";

INSERT INTO "Counter" ("schoolId", "key", "value")
SELECT "schoolId", 'staff', COUNT(*) FROM "StaffMember" GROUP BY "schoolId"
ON CONFLICT ("schoolId", "key") DO UPDATE SET "value" = GREATEST("Counter"."value", EXCLUDED."value");

ALTER TABLE "StaffMember" ALTER COLUMN "employeeCode" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Document_staffMemberId_idx" ON "Document"("staffMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolAdmin_staffMemberId_key" ON "SchoolAdmin"("staffMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_photoId_key" ON "StaffMember"("photoId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_schoolId_employeeCode_key" ON "StaffMember"("schoolId", "employeeCode");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolAdmin" ADD CONSTRAINT "SchoolAdmin_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
