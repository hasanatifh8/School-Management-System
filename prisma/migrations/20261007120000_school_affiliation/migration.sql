-- School: type, UDISE code and affiliation / registration details.

-- CreateEnum
CREATE TYPE "SchoolType" AS ENUM ('PRIVATE', 'GOVERNMENT', 'SEMI_GOVERNMENT', 'OTHER');

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "schoolType" "SchoolType",
ADD COLUMN     "udiseCode" TEXT,
ADD COLUMN     "affiliationNo" TEXT,
ADD COLUMN     "affiliationYear" INTEGER;
