-- ID cards: the common back's emergency contacts and guidelines, and staff departments.

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "idCardEmergency" TEXT,
ADD COLUMN     "idCardGuidelines" TEXT;

-- AlterTable
ALTER TABLE "StaffMember" ADD COLUMN     "department" TEXT;

