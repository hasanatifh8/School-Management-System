import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { RegisterView, pickView, registerDownloadHref } from "@/components/attendance/register-view";
import { PageHeader, buttonVariants } from "@/components/ui";
import { attendanceWindow, loadRegister, pickRange } from "@/lib/attendance";
import { db } from "@/lib/db";
import { sectionLabel } from "@/lib/queries";
import { getCurrentSchool } from "@/lib/school";

export default async function SectionRegisterPage({ params, searchParams }: PageProps<"/admin/attendance/[sectionId]/register">) {
  const { sectionId } = await params;
  const query = await searchParams;
  const school = await getCurrentSchool();
  const section = await db.section.findFirst({ where: { id: sectionId, class: { schoolId: school.id } }, include: { class: true } });
  if (!section) notFound();
  const win = await attendanceWindow(school.id);
  const range = pickRange(query, win);
  const register = await loadRegister(school.id, section.id, range.from, range.to, win);
  const base = `/admin/attendance/${section.id}`;

  return (
    <>
      <PageHeader
        title="Attendance register"
        breadcrumbs={[{ label: "Attendance", href: "/admin/attendance" }, { label: sectionLabel(section), href: base }, { label: "Register" }]}
        subtitle={`${sectionLabel(section)} · ${range.label}`}
        action={
          <a href={registerDownloadHref(section.id, range)} download className={buttonVariants.primary}>
            <Download className="h-4 w-4" />
            Download Excel
          </a>
        }
      />
      <RegisterView
        basePath={`${base}/register`}
        register={register}
        range={range}
        view={pickView(query, range)}
        min={win.min}
        max={win.max}
        dayHref={(d) => `${base}?date=${d}`}
      />
    </>
  );
}
