-- AlterTable
ALTER TABLE "School" ADD COLUMN     "studentIdPrefix" TEXT NOT NULL DEFAULT 'STU',
ADD COLUMN     "studentIdDigits" INTEGER NOT NULL DEFAULT 4;
