import { redirect } from "next/navigation";

/** Results moved to the Marks & results module (search params such as ?student= are kept). */
export default async function ExamResultsPage({ params, searchParams }: PageProps<"/admin/exams/[id]/results/[sectionId]">) {
  const { id, sectionId } = await params;
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === "string") query.set(k, v);
  redirect(`/admin/results/${id}/${sectionId}${query.size ? `?${query}` : ""}`);
}
