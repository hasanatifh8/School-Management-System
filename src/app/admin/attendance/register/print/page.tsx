import { notFound } from "next/navigation";
import { DrillNav } from "@/components/attendance/drill-nav";
import { RegisterPrintSheets } from "@/components/attendance/register-print";
import { PdfDownloadButton } from "@/components/pdf-download";
import { PrintButton } from "@/components/print-button";
import { attendanceWindow, loadRegister, pickMonth } from "@/lib/attendance";
import { STATUS_META, attendancePercent, isSunday, monthDates, monthName, parseISODate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { fullName, sectionLabel } from "@/lib/queries";
import { getCurrentSchool, schoolLogoUrl } from "@/lib/school";

const pct = (p: number | null) => (p == null ? "—" : `${p % 1 ? p.toFixed(1) : p}%`);

/** One class's register for a month as A4 landscape sheets, to print or save as PDF. ?section=, ?month= */
export default async function RegisterPrintPage({ searchParams }: PageProps<"/admin/attendance/register/print">) {
  const params = await searchParams;
  const school = await getCurrentSchool();
  const section = await db.section.findFirst({
    where: { id: typeof params.section === "string" ? params.section : "", class: { schoolId: school.id } },
    include: { class: true, classTeacher: { select: { firstName: true, middleName: true, lastName: true } } },
  });
  if (!section) notFound();
  const win = await attendanceWindow(school.id);
  const month = pickMonth(params.month, win);
  const dates = monthDates(month);
  const [reg, logo] = await Promise.all([
    loadRegister(school.id, section.id, dates[0], dates.at(-1)!, win),
    db.schoolLogo.findUnique({ where: { schoolId: school.id }, select: { updatedAt: true } }),
  ]);
  const label = monthName.format(parseISODate(`${month}-01`)!);
  const holidays: Record<string, string> = {
    ...Object.fromEntries([...reg.classHolidays]),
    ...Object.fromEntries([...reg.schoolHolidays].map(([d, h]) => [d, h.name])),
  };
  const title = `Attendance register · ${sectionLabel(section)}`;

  return (
    <div className="space-y-4">
      <DrillNav
        items={[
          { label: "Attendance", href: "/admin/attendance" },
          { label: "Register", href: `/admin/attendance/register?section=${section.id}&period=month&month=${month}` },
          { label: `${sectionLabel(section)} · Print` },
        ]}
      />
      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        <PdfDownloadButton root="class-register" landscape fileName={`${title} - ${label}`} />
        <PrintButton />
      </div>
      <RegisterPrintSheets
        root="class-register"
        school={school}
        logoUrl={schoolLogoUrl({ id: school.id, logo })}
        title={title}
        subtitle={`${label} · Session ${win.session.name} · ${reg.workingDays} working days${section.classTeacher ? ` · Class teacher: ${fullName(section.classTeacher)}` : ""}`}
        dates={reg.dates}
        holidays={holidays}
        totalHeads={["P", "A", "L", "HD", "LV", "%"]}
        rows={reg.students.map((s) => ({
          name: `${s.rollNumber ? `${s.rollNumber}. ` : ""}${s.name}`,
          sub: `${s.studentCode}${s.moved ? " · left class" : ""}`,
          cells: Object.fromEntries(
            reg.dates.map((d) => {
              const st = s.marks.get(d);
              return [d, holidays[d] ? "H" : st ? STATUS_META[st].short : isSunday(d) ? "H" : ""];
            }),
          ),
          totals: [String(s.period.PRESENT), String(s.period.ABSENT), String(s.period.LATE), String(s.period.HALF_DAY), String(s.period.LEAVE), pct(attendancePercent(s.period))],
        }))}
        legend="P Present · A Absent · L Late · HD Half day · LV Leave · H Holiday / Sunday · Late counts as present, half day as half."
        signatures={["Class teacher", "Principal"]}
      />
    </div>
  );
}
