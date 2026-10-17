import { notFound } from "next/navigation";
import { SalarySlipView } from "@/components/payroll/salary-slip-view";
import { loadPayslip } from "@/lib/payroll";
import { requireTeacher } from "@/lib/teacher-auth";

/** One of the teacher's own salary slips. */
export default async function TeacherPayslipPage({ params }: PageProps<"/teacher/salary/[id]">) {
  const { id } = await params;
  const { teacher, school } = await requireTeacher();
  const slip = await loadPayslip(school.id, id, teacher.id);
  if (!slip) notFound();
  return <SalarySlipView slip={slip} back={{ href: "/teacher/salary", label: "Salary slips" }} />;
}
