import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { RegisterView, pickView, registerDownloadHref } from "@/components/attendance/register-view";
import { PageHeader, buttonVariants } from "@/components/ui";
import { attendanceWindow, loadRegister, pickRange } from "@/lib/attendance";
import { sectionLabel } from "@/lib/queries";
import { requireTeacher } from "@/lib/teacher-auth";

export default async function TeacherRegisterPage({ searchParams }: PageProps<"/teacher/attendance/register">) {
  const ctx = await requireTeacher();
  if (!ctx.classSection) notFound();
  const query = await searchParams;
  const section = ctx.classSection;
  const win = await attendanceWindow(ctx.school.id);
  const range = pickRange(query, win);
  const register = await loadRegister(ctx.school.id, section.id, range.from, range.to, win);

  return (
    <>
      <PageHeader
        title="Attendance register"
        breadcrumbs={[{ label: "Attendance", href: "/teacher/attendance" }, { label: "Register" }]}
        subtitle={`${sectionLabel(section)} · ${range.label}`}
        action={
          <a href={registerDownloadHref(section.id, range, query)} download className={buttonVariants.primary}>
            <Download className="h-4 w-4" />
            Download Excel
          </a>
        }
      />
      <RegisterView
        basePath="/teacher/attendance/register"
        params={query}
        register={register}
        range={range}
        view={pickView(query, range)}
        min={win.min}
        max={win.max}
        dayHref={(d) => `/teacher/attendance?date=${d}`}
      />
    </>
  );
}
