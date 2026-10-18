-- AlterTable
ALTER TABLE "SalaryPayment" ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "publishedBy" TEXT;

-- Slips paid before publishing existed were already visible to teachers: keep them published.
UPDATE "SalaryPayment" SET "published" = true, "publishedAt" = "createdAt", "publishedBy" = "createdBy";
