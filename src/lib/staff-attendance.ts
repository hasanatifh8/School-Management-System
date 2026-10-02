import "server-only";
// Daily attendance of teachers (teaching staff) and staff members (non-teaching).
import type { ActionState } from "@/lib/action-state";
import { parseISODate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { onLeave } from "@/lib/leave";
import { photoUrl } from "@/lib/photos";
import { fullName } from "@/lib/queries";
import { STAFF_STATUSES, type StaffGroup, type StaffStatusKey } from "@/lib/staff-attendance-shared";

/** Everyone in the group with their mark for the date (approved leave pre-filled on an unmarked day). */
export async function loadStaffSheet(schoolId: string, group: StaffGroup, date: string) {
  const d = parseISODate(date)!;
  const teaching = group === "teaching";
  const [people, records, leave] = await Promise.all([
    teaching
      ? db.teacher
          .findMany({ where: { schoolId, status: "ACTIVE" }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] })
          .then((ts) => ts.map((t) => ({ id: t.id, name: fullName(t), sub: [t.specialization, t.employeeCode].filter(Boolean).join(" · "), photoId: t.photoId })))
      : db.staffMember
          .findMany({ where: { schoolId, status: "ACTIVE" }, orderBy: { name: "asc" } })
          .then((ss) => ss.map((s) => ({ id: s.id, name: s.name, sub: `${s.designation} · ${s.employeeCode}`, photoId: s.photoId }))),
    db.staffAttendance.findMany({ where: { schoolId, date: d, [teaching ? "teacherId" : "staffId"]: { not: null } } }),
    onLeave(schoolId, d),
  ]);
  const byPerson = new Map(records.map((r) => [(teaching ? r.teacherId : r.staffId)!, r]));
  const marked = people.some((p) => byPerson.has(p.id));
  return {
    people: people.map((p) => ({ id: p.id, name: p.name, sub: p.sub, photoUrl: photoUrl(p.photoId) })),
    initial: Object.fromEntries(
      people.map((p) => {
        const r = byPerson.get(p.id);
        const status: StaffStatusKey = r?.status ?? (leave.has(p.id) ? "ON_LEAVE" : "PRESENT");
        return [p.id, { status, remark: r?.remark ?? (!r && leave.has(p.id) ? "Approved leave" : "") }];
      }),
    ),
    marked,
    markedBy: records.find((r) => r.markedBy)?.markedBy ?? null,
    onLeave: people.filter((p) => leave.has(p.id)).length,
  };
}

/** Saves the group's marks for a date. Fields: `s:<personId>` = status, `r:<personId>` = remark. */
export async function saveStaffSheet(schoolId: string, group: StaffGroup, date: string, formData: FormData, markedBy: string): Promise<ActionState> {
  const d = parseISODate(date);
  if (!d) return { error: "Choose a date." };
  const teaching = group === "teaching";
  const key = teaching ? "teacherId" : "staffId";
  const people = teaching
    ? await db.teacher.findMany({ where: { schoolId, status: "ACTIVE" }, select: { id: true } })
    : await db.staffMember.findMany({ where: { schoolId, status: "ACTIVE" }, select: { id: true } });
  if (!people.length) return { error: teaching ? "There are no teachers yet." : "There are no staff members yet." };

  const rows: { id: string; status: StaffStatusKey; remark: string | null }[] = [];
  for (const { id } of people) {
    const status = STAFF_STATUSES.find((s) => s === formData.get(`s:${id}`));
    if (!status) return { error: "Mark everyone before saving." };
    const remark = String(formData.get(`r:${id}`) ?? "").trim();
    if (remark.length > 120) return { error: "Keep remarks under 120 characters." };
    rows.push({ id, status, remark: remark || null });
  }

  await db.$transaction([
    db.staffAttendance.deleteMany({ where: { schoolId, date: d, [key]: { in: rows.map((r) => r.id) } } }),
    db.staffAttendance.createMany({ data: rows.map((r) => ({ schoolId, date: d, [key]: r.id, status: r.status, remark: r.remark, markedBy })) }),
  ]);
  const present = rows.filter((r) => r.status === "PRESENT" || r.status === "HALF_DAY").length;
  return { ok: true, message: `Saved ${teaching ? "teaching" : "non-teaching"} staff attendance: ${present} of ${rows.length} present.` };
}

/** Teaching and non-teaching totals for a date, for the overview. */
export async function staffDaySummary(schoolId: string, date: string) {
  const d = parseISODate(date)!;
  const [teachers, staff, records] = await Promise.all([
    db.teacher.count({ where: { schoolId, status: "ACTIVE" } }),
    db.staffMember.count({ where: { schoolId, status: "ACTIVE" } }),
    db.staffAttendance.findMany({ where: { schoolId, date: d }, select: { teacherId: true, status: true } }),
  ]);
  const count = (teaching: boolean) => {
    const rs = records.filter((r) => !!r.teacherId === teaching);
    return { marked: rs.length > 0, present: rs.filter((r) => r.status === "PRESENT" || r.status === "HALF_DAY").length, absent: rs.filter((r) => r.status === "ABSENT").length };
  };
  return { teaching: { total: teachers, ...count(true) }, nonTeaching: { total: staff, ...count(false) } };
}
