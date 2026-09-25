import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { MonthNav } from "@/components/attendance/date-nav";
import { RegisterGrid, RegisterLegend } from "@/components/attendance/register-grid";
import { Card, PageHeader, buttonVariants } from "@/components/ui";
import { attendanceWindow, loadRegister, pickMonth } from "@/lib/attendance";
import { sectionLabel } from "@/lib/queries";
import { requireTeacher } from "@/lib/teacher-auth";

export default async function TeacherRegisterPage({ searchParams }: PageProps<"/teacher/attendance/register">) {
  const ctx = await requireTeacher();
  if (!ctx.classSection) notFound();
  const section = ctx.classSection;
  const win = await attendanceWindow(ctx.school.id);
  const month = pickMonth((await searchParams).month, win);
  const register = await loadRegister(ctx.school.id, section.id, month, win);

  return (
    <>
      <PageHeader
        title="Attendance register"
        breadcrumbs={[{ label: "Attendance", href: "/teacher/attendance" }, { label: "Register" }]}
        subtitle={`${sectionLabel(section)} · ${register.workingDays} working day${register.workingDays === 1 ? "" : "s"} marked`}
        action={
          <a href={`/api/attendance/register?section=${section.id}&month=${month}`} download className={buttonVariants.secondary}>
            <Download className="h-4 w-4" />
            Download Excel
          </a>
        }
      />
      <Card
        padded={false}
        title={<MonthNav basePath="/teacher/attendance/register" month={month} min={win.min.slice(0, 7)} max={win.max.slice(0, 7)} />}
      >
        <RegisterGrid register={register} today={win.max} dayHref={(d) => `/teacher/attendance?date=${d}`} />
        <div className="border-t border-slate-100 px-6 py-3">
          <RegisterLegend />
        </div>
      </Card>
    </>
  );
}
