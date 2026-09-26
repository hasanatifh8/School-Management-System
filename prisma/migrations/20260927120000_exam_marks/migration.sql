-- CreateTable
CREATE TABLE "ExamMark" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "marks" DOUBLE PRECISION,
    "absent" BOOLEAN NOT NULL DEFAULT false,
    "enteredBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamMark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamResult" (
    "examId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedBy" TEXT NOT NULL,

    CONSTRAINT "ExamResult_pkey" PRIMARY KEY ("examId","sectionId")
);

-- CreateIndex
CREATE INDEX "ExamMark_studentId_idx" ON "ExamMark"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamMark_paperId_studentId_key" ON "ExamMark"("paperId", "studentId");

-- CreateIndex
CREATE INDEX "ExamResult_sectionId_idx" ON "ExamResult"("sectionId");

-- AddForeignKey
ALTER TABLE "ExamMark" ADD CONSTRAINT "ExamMark_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "ExamPaper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamMark" ADD CONSTRAINT "ExamMark_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

