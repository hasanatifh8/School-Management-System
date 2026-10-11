import "server-only";
// One day's attendance for a whole group (all students, teaching staff or
// non-teaching staff): the KPI numbers and the roster behind each of them.
import { isoDate, parseISODate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { approvedLeaveOn } from "@/lib/leave";
import { staffDepartment, teacherDepartment, type LeaveCategoryKey } from "@/lib/leave-shared";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";

export const ROSTER_GROUPS = ["students", "teaching", "non-teaching"] as const;
export type RosterGroup = (typeof ROSTER_GROUPS)[number];
export const pickRosterGroup = (v: unknown): RosterGroup => (ROSTER_GROUPS.includes(v as RosterGroup) ? (v as RosterGroup) : "students");
export const GROUP_LABELS: Record<RosterGroup, string> = { students: "Students", teaching: "Teaching staff", "non-teaching": "Non-teaching staff" };

/** The KPI buckets a person can fall into on a day (late people are also counted as present). */
export const ROSTER_FILTERS = ["present", "absent", "leave", "late", "unmarked"] as const;
export type RosterFilter = (typeof ROSTER_FILTERS)[number];
export const pickRosterFilter = (v: unknown): RosterFilter | null => (ROSTER_FILTERS.includes(v as RosterFilter) ? (v as RosterFilter) : null);
export const FILTER_LABELS: Record<RosterFilter, string> = {
  present: "Present",
  absent: "Absent",
  leave: "On leave",
  late: "Late arrivals",
  unmarked: "Not marked",
};

/** A day's mark in one vocabulary for students and staff. */
export type DayMark = "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "LEAVE";

export type RosterPerson = {
  id: string;
  name: string;
  code: string;
  /** Class for a student, specialisation or designation for staff. */
  sub: string;
  /** Department for staff, class for students (for search). */
  department: string;
  photoUrl: string | null;
  href: string;
  mark: DayMark | null;
  remark: string | null;
  leave: { category: LeaveCategoryKey; from: string; to: string } | null;
};

export function rosterBuckets(p: Pick<RosterPerson, "mark" | "leave">): RosterFilter[] {
  const out: RosterFilter[] = [];
  if (p.mark === "PRESENT" || p.mark === "LATE" || p.mark === "HALF_DAY") out.push("present");
  if (p.mark === "LATE") out.push("late");
  if (p.mark === "ABSENT") out.push("absent");
  if (p.leave || p.mark === "LEAVE") out.push("leave");
  if (!p.mark && !p.leave) out.push("unmarked");
  return out;
}

/** Everyone in the group with their mark for the date, plus the KPI counts. */
export async function dayRoster(schoolId: string, group: RosterGroup, date: string) {
  const d = parseISODate(date)!;
  const [people, leave] = await Promise.all([loadPeople(schoolId, group, d), approvedLeaveOn(schoolId, d)]);
  const roster: RosterPerson[] = people.map((p) => {
    const l = leave.get(p.id);
    return { ...p, leave: l ? { category: l.category, from: isoDate(l.fromDate), to: isoDate(l.toDate) } : null };
  });
  const counts = Object.fromEntries(ROSTER_FILTERS.map((f) => [f, 0])) as Record<RosterFilter, number>;
  for (const p of roster) for (const b of rosterBuckets(p)) counts[b]++;
  const marked = roster.filter((p) => p.mark).length;
  return { people: roster, counts, marked, total: roster.length };
}

export type DayRoster = Awaited<ReturnType<typeof dayRoster>>;

async function loadPeople(schoolId: string, group: RosterGroup, d: Date): Promise<Omit<RosterPerson, "leave">[]> {
  if (group === "students") {
    const [students, records] = await Promise.all([
      db.student.findMany({
        where: { schoolId, status: "ACTIVE", sectionId: { not: null } },
        orderBy: [{ section: { class: { sortOrder: "asc" } } }, { section: { name: "asc" } }, { rollNumber: { sort: "asc", nulls: "last" } }, { firstName: "asc" }],
        select: { id: true, firstName: true, middleName: true, lastName: true, studentCode: true, photoId: true, rollNumber: true, section: { include: { class: true } } },
      }),
      db.attendanceRecord.findMany({
        where: { day: { schoolId, date: d, holiday: null } },
        select: { studentId: true, status: true, remark: true },
      }),
    ]);
    const byId = new Map(records.map((r) => [r.studentId, r]));
    return students.map((s) => {
      const cls = s.section ? sectionLabel(s.section) : "";
      const r = byId.get(s.id);
      return {
        id: s.id,
        name: fullName(s),
        code: s.studentCode,
        sub: [cls, s.rollNumber ? `Roll ${s.rollNumber}` : null].filter(Boolean).join(" · "),
        department: cls,
        photoUrl: photoUrl(s.photoId),
        href: `/admin/students/${s.id}`,
        mark: r?.status ?? null,
        remark: r?.remark ?? null,
      };
    });
  }

  const teaching = group === "teaching";
  const records = await db.staffAttendance.findMany({
    where: { schoolId, date: d, [teaching ? "teacherId" : "staffId"]: { not: null } },
    select: { teacherId: true, staffId: true, status: true, remark: true },
  });
  const byId = new Map(records.map((r) => [(r.teacherId ?? r.staffId)!, r]));
  const mark = (id: string): DayMark | null => {
    const s = byId.get(id)?.status;
    return s ? (s === "ON_LEAVE" ? "LEAVE" : s) : null;
  };
  if (teaching) {
    const teachers = await db.teacher.findMany({ where: { schoolId, status: "ACTIVE" }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] });
    return teachers.map((t) => ({
      id: t.id,
      name: fullName(t),
      code: t.employeeCode,
      sub: t.specialization ?? "Teacher",
      department: teacherDepartment(t),
      photoUrl: photoUrl(t.photoId),
      href: `/admin/teachers/${t.id}`,
      mark: mark(t.id),
      remark: byId.get(t.id)?.remark ?? null,
    }));
  }
  const staff = await db.staffMember.findMany({ where: { schoolId, status: "ACTIVE" }, orderBy: { name: "asc" } });
  return staff.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.employeeCode,
    sub: [s.designation, s.department].filter(Boolean).join(" · "),
    department: staffDepartment(s),
    photoUrl: photoUrl(s.photoId),
    href: `/admin/staff/${s.id}`,
    mark: mark(s.id),
    remark: byId.get(s.id)?.remark ?? null,
  }));
}

/** Roster filtered by bucket and search (name, ID, class or department). */
export function filterRoster(people: RosterPerson[], filter: RosterFilter | null, q: string) {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return people.filter(
    (p) =>
      (!filter || rosterBuckets(p).includes(filter)) &&
      words.every((w) => p.name.toLowerCase().includes(w) || p.code.toLowerCase().includes(w) || p.department.toLowerCase().includes(w)),
  );
}

/** Percent of `n` in `of`, one decimal, or null when nothing is marked. */
export const share = (n: number, of: number) => (of ? Math.round((n / of) * 1000) / 10 : null);
