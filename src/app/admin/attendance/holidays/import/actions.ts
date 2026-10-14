"use server";

import { revalidatePath } from "next/cache";
import { attendanceWindow, getSaturdayOff } from "@/lib/attendance";
import { addDays, formatISO, isoDate, isWeeklyOff, parseISODate, shortDate, weeklyOffName } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { readImportFile } from "@/lib/import/excel";
import { toIsoDate, type ImportRowResult, type ImportState } from "@/lib/import/rows";
import { getCurrentSchool } from "@/lib/school";

const MAX_HOLIDAY_DAYS = 60;

/**
 * Checks (mode=preview) or adds (mode=import) school holidays from the template.
 * Each row is one holiday, a single day or a From–To break. Weekly offs inside it are
 * skipped since they are already off, as are days that are already holidays.
 */
export async function importHolidays(_: ImportState, formData: FormData): Promise<ImportState> {
  const school = await getCurrentSchool(); // admins / Power Admin only
  const read = await readImportFile("holidays", formData.get("file"));
  if ("error" in read) return { error: read.error };

  const [{ session }, saturdayOff] = await Promise.all([attendanceWindow(school.id), getSaturdayOff(school.id)]);
  const start = isoDate(session.startDate);
  const end = isoDate(session.endDate);
  const existing = await db.holiday.findMany({
    where: { schoolId: school.id, date: { gte: session.startDate, lte: session.endDate } },
    select: { date: true, name: true },
  });
  const taken = new Map(existing.map((h) => [isoDate(h.date), h.name]));
  const inFile = new Map<string, number>(); // date → row that adds it

  const results: (ImportRowResult & { dates?: string[]; holiday?: string })[] = [];
  for (const { rowNumber, values: v } of read.rows) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const name = (v.name ?? "").trim();
    if (name.length < 2) errors.push("Holiday: enter the holiday name");
    else if (name.length > 80) errors.push("Holiday: at most 80 characters");

    const from = toIsoDate(v.fromDate ?? "");
    const toRaw = toIsoDate(v.toDate ?? "");
    if (!from) errors.push(from === "" ? "From date is required" : "From date: use DD-MM-YYYY, e.g. 20-10-2026");
    if (toRaw === null) errors.push("To date: use DD-MM-YYYY, e.g. 24-10-2026");
    const to = toRaw || from;

    let dates: string[] = [];
    let detail = "";
    if (from && to) {
      detail = from === to ? formatISO(from, shortDate) : `${formatISO(from, shortDate)} – ${formatISO(to, shortDate)}`;
      if (to < from) errors.push("To date is before From date");
      else if (from < start || to > end) errors.push(`Dates must fall within session ${session.name}`);
      else {
        let offs = 0;
        let already = 0;
        let repeated = 0;
        for (let day = from; day <= to && dates.length <= MAX_HOLIDAY_DAYS; day = addDays(day, 1)) {
          if (isWeeklyOff(day, saturdayOff)) offs++;
          else if (taken.has(day)) already++;
          else if (inFile.has(day)) repeated++;
          else dates.push(day);
        }
        if (dates.length > MAX_HOLIDAY_DAYS) errors.push(`At most ${MAX_HOLIDAY_DAYS} days per row`);
        else if (!dates.length) {
          errors.push(
            from === to && offs
              ? `${weeklyOffName(from)} is already a weekly off`
              : from === to && already
                ? `Already a holiday (${taken.get(from)})`
                : "Every day in this range is already off or a holiday",
          );
        } else {
          detail += ` · ${dates.length} day${dates.length === 1 ? "" : "s"}`;
          if (offs) warnings.push(`${offs} weekly off${offs === 1 ? "" : "s"} skipped`);
          if (already) warnings.push(`${already} day${already === 1 ? " is" : "s are"} already a holiday`);
          if (repeated) warnings.push(`${repeated} day${repeated === 1 ? "" : "s"} also in an earlier row`);
        }
      }
    }
    if (errors.length) dates = [];
    for (const d of dates) inFile.set(d, rowNumber);

    results.push({ rowNumber, name: name || "—", detail: detail || "—", errors, warnings, ...(dates.length && { dates, holiday: name }) });
  }

  const valid = results.filter((r) => r.dates);
  const preview = {
    fileName: (formData.get("file") as File).name,
    rows: results.map(({ rowNumber, name, detail, errors, warnings }) => ({ rowNumber, name, detail, errors, warnings })),
    valid: valid.length,
    invalid: results.length - valid.length,
  };
  if (formData.get("mode") !== "import") return { preview };
  if (!valid.length) return { preview, error: "There are no valid rows to import." };

  await db.holiday.createMany({
    data: valid.flatMap((r) => r.dates!.map((d) => ({ schoolId: school.id, date: parseISODate(d)!, name: r.holiday! }))),
    skipDuplicates: true, // a day added from elsewhere since the check
  });
  revalidatePath("/", "layout");
  return { done: { created: valid.length, skipped: results.length - valid.length, codes: [] } };
}
