import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { MonthNav } from "@/components/attendance/date-nav";
import { RegisterGrid, RegisterLegend } from "@/components/attendance/register-grid";
import { Card, PageHeader, buttonVariants } from "@/components/ui";
import { attendanceWindow, loadRegister, pickMonth } from "@/lib/attendance";
import { db } from "@/lib/db";
import { sectionLabel } from "@/lib/queries";
import { getCurrentSchool } from "@/lib/school";

export default async function SectionRegisterPage({ params, searchParams }: PageProps<"/admin/attendance/[sectionId]/register">) {
  const { sectionId } = await params;
  const school = await getCurrentSchool();
  const section = await db.section.findFirst({ where: { id: sectionId, class: { schoolId: school.id } }, include: { class: true } });
  if (!section) notFound();
  const win = await attendanceWindow(school.id);
  const month = pickMonth((await searchParams).month, win);
  const register = await loadRegister(school.id, section.id, month, win);
  const base = `/admin/attendance/${section.id}`;

  return (
    <>
      <PageHeader
        title="Attendance register"
        breadcrumbs={[{ label: "Attendance", href: "/admin/attendance" }, { label: sectionLabel(section), href: base }, { label: "Register" }]}
        subtitle={`${sectionLabel(section)} · ${register.workingDays} working day${register.workingDays === 1 ? "" : "s"} marked`}
        action={
          <a href={`/api/attendance/register?section=${section.id}&month=${month}`} download className={buttonVariants.secondary}>
            <Download className="h-4 w-4" />
            Download Excel
          </a>
        }
      />
      <Card padded={false} title={<MonthNav basePath={`${base}/register`} month={month} min={win.min.slice(0, 7)} max={win.max.slice(0, 7)} />}>
        <RegisterGrid register={register} today={win.max} dayHref={(d) => `${base}?date=${d}`} />
        <div className="border-t border-slate-100 px-6 py-3">
          <RegisterLegend />
        </div>
      </Card>
    </>
  );
}
