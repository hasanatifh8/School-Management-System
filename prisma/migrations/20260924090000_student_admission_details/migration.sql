-- CreateEnum
CREATE TYPE "StudentCategory" AS ENUM ('GENERAL', 'OBC', 'SC_ST', 'MINORITY');

-- The existing address becomes the primary address; renaming keeps saved data.
ALTER TABLE "Student" RENAME COLUMN "address" TO "primaryAddress";

-- AlterTable
ALTER TABLE "Student"
ADD COLUMN     "aadhaarNumber" TEXT,
ADD COLUMN     "caste" TEXT,
ADD COLUMN     "category" "StudentCategory",
ADD COLUMN     "correspondenceAddress" TEXT,
ADD COLUMN     "lastSchoolName" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "religion" TEXT,
ADD COLUMN     "whatsappNumber" TEXT;
