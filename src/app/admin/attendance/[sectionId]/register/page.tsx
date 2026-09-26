import { redirect } from "next/navigation";

/** Older per-class register links now open the school-wide register with that class chosen. */
export default async function SectionRegisterPage({ params, searchParams }: PageProps<"/admin/attendance/[sectionId]/register">) {
  const { sectionId } = await params;
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === "string") query.set(k, v);
  query.set("section", sectionId);
  redirect(`/admin/attendance/register?${query}`);
}
