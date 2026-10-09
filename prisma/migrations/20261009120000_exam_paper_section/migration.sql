-- Exam papers: optionally for one section of a class only.

-- AlterTable
ALTER TABLE "ExamPaper" ADD COLUMN     "sectionId" TEXT;

-- AddForeignKey
ALTER TABLE "ExamPaper" ADD CONSTRAINT "ExamPaper_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
