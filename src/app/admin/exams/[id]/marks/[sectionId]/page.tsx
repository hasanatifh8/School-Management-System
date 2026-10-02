import { redirect } from "next/navigation";

/** Marks moved to the Marks & results module. */
export default async function ExamMarksPage({ params }: PageProps<"/admin/exams/[id]/marks/[sectionId]">) {
  const { id, sectionId } = await params;
  redirect(`/admin/results/${id}/${sectionId}/marks`);
}
