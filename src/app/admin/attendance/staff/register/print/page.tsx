import { DrillNav } from "@/components/attendance/drill-nav";
import { RegisterPrintSheets } from "@/components/attendance/register-print";
import { PdfDownloadButton } from "@/components/pdf-download";
import { PrintButton } from "@/components/print-button";
import { attendanceWindow, pickMonth } from "@/lib/attendance";
import { GROUP_LABELS } from "@/lib/attendance-day";
import { isSunday, monthName, parseISODate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { getCurrentSchool, schoolLogoUrl } from "@/lib/school";
import { STAFF_STATUS_META, pickStaffGroup } from "@/lib/staff-attendance-shared";
import { loadStaffRegister } from "@/lib/staff-register";

const num = (n: number) => (n % 1 ? n.toFixed(1) : String(n));

/** The staff register for a month as A4 landscape sheets, to print or save as PDF. */
export default async function StaffRegisterPrintPage({ searchParams }: PageProps<"/admin/attendance/staff/register/print">) {
  const params = await searchParams;
  const school = await getCurrentSchool();
  const win = await attendanceWindow(school.id);
  const group = pickStaffGroup(params.group);
  const month = pickMonth(params.month, win);
  const [reg, logo] = await Promise.all([
    loadStaffRegister(school.id, group, month, win.today),
    db.schoolLogo.findUnique({ where: { schoolId: school.id }, select: { updatedAt: true } }),
  ]);
  const label = monthName.format(parseISODate(`${month}-01`)!);
  const holidays = Object.fromEntries(reg.holidays);
  const title = `${GROUP_LABELS[group]} attendance register`;

  return (
    <div className="space-y-4">
      <DrillNav
        items={[
          { label: "Attendance", href: "/admin/attendance" },
          { label: GROUP_LABELS[group], href: `/admin/attendance/staff?group=${group}` },
          { label: "Register", href: `/admin/attendance/staff/register?group=${group}&month=${month}` },
          { label: "Print" },
        ]}
      />
      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        <PdfDownloadButton root="staff-register" landscape fileName={`${title} - ${label}`} />
        <PrintButton />
      </div>
      <RegisterPrintSheets
        root="staff-register"
        school={school}
        logoUrl={schoolLogoUrl({ id: school.id, logo })}
        title={title}
        subtitle={`${label} · Session ${win.session.name} · ${reg.working.length} working days`}
        dates={reg.dates}
        holidays={holidays}
        totalHeads={["Present", "Absent", "Leave", "LOP", "%"]}
        rows={reg.rows.map((r) => ({
          name: r.name,
          sub: [r.code, r.department].filter(Boolean).join(" · "),
          cells: Object.fromEntries(
            reg.dates.map((d) => {
              const s = r.marks[d];
              return [d, s ? STAFF_STATUS_META[s].short : r.leaveDays.includes(d) ? "LV" : holidays[d] || isSunday(d) ? "H" : ""];
            }),
          ),
          totals: [num(r.present), String(r.absent), String(r.leave), num(r.lop), r.percent == null ? "—" : `${num(r.percent)}%`],
        }))}
        legend="P Present · A Absent · L Late · HD Half day · LV Leave · H Holiday / weekly off · LOP (loss of pay) = absent days + half of each half day · Approved leave is not counted in the %."
        signatures={["Prepared by", "Principal"]}
      />
    </div>
  );
}
