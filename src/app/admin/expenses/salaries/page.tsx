import { redirect } from "next/navigation";

/** Paying salaries moved to Payroll; old links (and a chosen month) land there. */
export default async function SalariesPage({ searchParams }: PageProps<"/admin/expenses/salaries">) {
  const { month } = await searchParams;
  redirect(typeof month === "string" ? `/admin/payroll?month=${encodeURIComponent(month)}` : "/admin/payroll");
}
