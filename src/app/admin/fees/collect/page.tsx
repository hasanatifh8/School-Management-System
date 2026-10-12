import { redirect } from "next/navigation";

/** Collecting fees moved to the Fee desk; old links (and a chosen class) land there. */
export default async function CollectPage({ searchParams }: PageProps<"/admin/fees/collect">) {
  const { section } = await searchParams;
  redirect(typeof section === "string" ? `/admin/fee-desk?section=${encodeURIComponent(section)}` : "/admin/fee-desk");
}
