-- Exam papers: optional papers with their own pass marks.

-- AlterTable
ALTER TABLE "ExamPaper" ADD COLUMN     "optional" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passMarks" INTEGER;
