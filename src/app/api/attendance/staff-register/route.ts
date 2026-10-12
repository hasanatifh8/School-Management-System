import ExcelJS from "exceljs";
import { attendanceWindow, pickMonth } from "@/lib/attendance";
import { GROUP_LABELS } from "@/lib/attendance-day";
import { isSunday, monthName, parseISODate } from "@/lib/attendance-shared";
import { getCurrentSchool } from "@/lib/school";
import { STAFF_STATUS_META, pickStaffGroup } from "@/lib/staff-attendance-shared";
import { loadStaffRegister } from "@/lib/staff-register";

const FILL = { header: "FF5B4EE8", off: "FFF1F5F9", absent: "FFFFE4E6", half: "FFFEF9C3" };
const TEXT = { good: "FF047857", warn: "FFB45309", bad: "FFBE123C", muted: "FF64748B" };

/**
 * GET /api/attendance/staff-register?group=teaching|non-teaching&month=YYYY-MM
 * The staff monthly register as Excel (admins only): one row per person, a
 * column per day, then Present, Absent, Late, Half day, Leave, LOP and %.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const school = await getCurrentSchool();
  const win = await attendanceWindow(school.id);
  const group = pickStaffGroup(url.searchParams.get("group"));
  const month = pickMonth(url.searchParams.get("month") ?? undefined, win);
  const reg = await loadStaffRegister(school.id, group, month, win.today);
  const label = monthName.format(parseISODate(`${month}-01`)!);

  const wb = new ExcelJS.Workbook();
  wb.creator = school.name;
  const ws = wb.addWorksheet(label, { views: [{ state: "frozen", xSplit: 3, ySplit: 3 }], pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1 } });
  ws.addRow([`${school.name} · ${GROUP_LABELS[group]} attendance · ${label}`]).font = { bold: true, size: 13 };
  ws.addRow([
    `Working days: ${reg.working.length} · P Present, A Absent, L Late, HD Half day, LV Leave, H Holiday/weekly off · LOP = absent days + half of each half day`,
  ]).font = { color: { argb: TEXT.muted }, size: 10 };
  const header = ws.addRow(["ID", "Name", "Department", ...reg.dates.map((d) => Number(d.slice(8))), "Present", "Absent", "Late", "Half day", "Leave", "LOP", "%"]);
  header.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL.header } };
    c.alignment = { horizontal: "center", vertical: "middle" };
  });

  const firstDay = 4;
  const firstTotal = firstDay + reg.dates.length;
  for (const r of reg.rows) {
    const row = ws.addRow([
      r.code,
      r.name,
      r.department,
      ...reg.dates.map((d) => {
        const s = r.marks[d];
        return s ? STAFF_STATUS_META[s].short : r.leaveDays.includes(d) ? "LV" : reg.holidays.has(d) || isSunday(d) ? "H" : "";
      }),
      r.present,
      r.absent,
      r.late,
      r.halfDay,
      r.leave,
      r.lop,
      r.percent == null ? "" : r.percent / 100,
    ]);
    reg.dates.forEach((d, i) => {
      const cell = row.getCell(firstDay + i);
      cell.alignment = { horizontal: "center" };
      const fill = cell.value === "A" ? FILL.absent : cell.value === "HD" ? FILL.half : reg.holidays.has(d) || isSunday(d) ? FILL.off : null;
      if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    });
    for (let c = firstTotal; c < firstTotal + 7; c++) row.getCell(c).alignment = { horizontal: "center" };
    const pct = row.getCell(firstTotal + 6);
    pct.numFmt = "0.0%";
    if (r.percent != null) pct.font = { bold: true, color: { argb: r.percent >= 90 ? TEXT.good : r.percent >= 75 ? TEXT.warn : TEXT.bad } };
    if (r.lop) row.getCell(firstTotal + 5).font = { bold: true, color: { argb: TEXT.warn } };
  }
  if (reg.holidays.size) {
    ws.addRow([]);
    ws.addRow(["", `Holidays — ${[...reg.holidays].map(([d, n]) => `${Number(d.slice(8))}: ${n}`).join(" · ")}`]).font = { color: { argb: TEXT.muted }, size: 10 };
  }
  ws.addRow([]);
  ws.addRow([]);
  ws.addRow(["", "Prepared by: ____________________", "", ...reg.dates.map(() => ""), "Principal: ____________________"]);

  ws.getColumn(1).width = 11;
  ws.getColumn(2).width = 26;
  ws.getColumn(3).width = 20;
  reg.dates.forEach((_, i) => (ws.getColumn(firstDay + i).width = 4));
  for (let c = firstTotal; c < firstTotal + 7; c++) ws.getColumn(c).width = 9;

  const file = Buffer.from(await wb.xlsx.writeBuffer());
  return new Response(file, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="staff-attendance-${group}-${month}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
