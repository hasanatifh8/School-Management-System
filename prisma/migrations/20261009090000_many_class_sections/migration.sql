-- A teacher can be class teacher of several sections.

-- DropIndex
DROP INDEX "Section_classTeacherId_key";

-- CreateIndex
CREATE INDEX "Section_classTeacherId_idx" ON "Section"("classTeacherId");
