import "server-only";
import { db } from "@/lib/db";
import type { ActionState } from "@/lib/action-state";
import { fullName, sectionLabel } from "@/lib/queries";
import { DAY_NAMES, SLOT_LABELS, slotKey } from "@/lib/timetable-shared";

export function getPeriods(schoolId: string) {
  return db.period.findMany({ where: { schoolId }, orderBy: [{ sortOrder: "asc" }, { startTime: "asc" }] });
}

/** Everything the timetable editor for one section needs. */
export async function loadSectionTimetable(schoolId: string, sectionId: string) {
  const section = await db.section.findFirst({
    where: { id: sectionId, class: { schoolId } },
    include: {
      class: { include: { subjects: { include: { subject: true } } } },
      classTeacher: true,
      timetable: true,
      subjectAssignments: true,
    },
  });
  if (!section) return null;
  const [school, periods, slots, teachers, otherSlots] = await Promise.all([
    db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { timetableDays: true } }),
    getPeriods(schoolId),
    db.timetableSlot.findMany({ where: { sectionId } }),
    db.teacher.findMany({ where: { schoolId, status: "ACTIVE" }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }),
    // Where each teacher already teaches, to flag clashes while editing.
    db.timetableSlot.findMany({
      where: { section: { class: { schoolId } }, sectionId: { not: sectionId }, teacherId: { not: null } },
      select: { teacherId: true, day: true, periodId: true, section: { include: { class: true } } },
    }),
  ]);
  const busy: Record<string, string> = {};
  for (const s of otherSlots) busy[`${s.teacherId}:${slotKey(s.day, s.periodId)}`] = sectionLabel(s.section);

  return {
    section,
    days: [...school.timetableDays].sort(),
    periods,
    subjects: section.class.subjects.map((cs) => ({ id: cs.subject.id, name: cs.subject.name })).sort((a, b) => a.name.localeCompare(b.name)),
    teachers: teachers.map((t) => ({ id: t.id, name: fullName(t) })),
    subjectTeacher: Object.fromEntries(section.subjectAssignments.map((a) => [a.subjectId, a.teacherId])),
    busy,
    slots: Object.fromEntries(
      slots.map((s) => [slotKey(s.day, s.periodId), { subject: s.subjectId ?? (s.label ? `label:${s.label}` : ""), teacher: s.teacherId ?? "" }]),
    ),
  };
}

/**
 * Replaces a section's timetable with the submitted grid. Fields are
 * `subject:<day>:<periodId>` (a subject id or "label:Library") and
 * `teacher:<day>:<periodId>`. A teacher can't be in two classes at once.
 */
export async function saveSectionTimetable(schoolId: string, sectionId: string, formData: FormData, who: string): Promise<ActionState> {
  const data = await loadSectionTimetable(schoolId, sectionId);
  if (!data) return { error: "Class not found." };
  const { days, periods, subjects, teachers, busy } = data;
  const subjectIds = new Set(subjects.map((s) => s.id));
  const teacherName = new Map(teachers.map((t) => [t.id, t.name]));

  const rows: { day: number; periodId: string; subjectId: string | null; label: string | null; teacherId: string | null }[] = [];
  const clashes: string[] = [];
  for (const day of days) {
    for (const p of periods) {
      if (p.isBreak) continue;
      const key = slotKey(day, p.id);
      const subject = String(formData.get(`subject:${key}`) ?? "");
      const teacher = String(formData.get(`teacher:${key}`) ?? "");
      if (!subject) continue;
      let subjectId: string | null = null;
      let label: string | null = null;
      if (subject.startsWith("label:")) {
        label = subject.slice(6);
        if (!(SLOT_LABELS as readonly string[]).includes(label)) return { error: "Choose a period type from the list." };
      } else if (subjectIds.has(subject)) {
        subjectId = subject;
      } else {
        return { error: "A subject isn't taught in this class any more. Reload the page and try again." };
      }
      if (teacher && !teacherName.has(teacher)) return { error: "A chosen teacher isn't active any more. Reload the page and try again." };
      const other = teacher ? busy[`${teacher}:${key}`] : undefined;
      if (other) clashes.push(`${teacherName.get(teacher)} already teaches ${other} on ${DAY_NAMES[day]}, ${p.name}`);
      rows.push({ day, periodId: p.id, subjectId, label, teacherId: teacher || null });
    }
  }
  if (clashes.length) {
    return { error: `Teacher clash: ${clashes.slice(0, 3).join("; ")}${clashes.length > 3 ? ` and ${clashes.length - 3} more` : ""}.` };
  }

  await db.$transaction([
    db.timetableSlot.deleteMany({ where: { sectionId } }),
    db.timetableSlot.createMany({ data: rows.map((r) => ({ ...r, sectionId })) }),
    db.timetable.upsert({ where: { sectionId }, create: { sectionId, updatedBy: who }, update: { updatedBy: who } }),
  ]);
  return { ok: true, message: `Timetable saved: ${rows.length} period(s) filled.` };
}

/** A teacher's week: every period they teach, across sections. */
export async function loadTeacherTimetable(schoolId: string, teacherId: string) {
  const [school, periods, slots] = await Promise.all([
    db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { timetableDays: true } }),
    getPeriods(schoolId),
    db.timetableSlot.findMany({
      where: { teacherId, section: { class: { schoolId } } },
      include: { subject: true, section: { include: { class: true } } },
    }),
  ]);
  return {
    days: [...school.timetableDays].sort(),
    periods,
    cells: Object.fromEntries(
      slots.map((s) => [slotKey(s.day, s.periodId), { title: s.subject?.name ?? s.label ?? "", sub: sectionLabel(s.section) }]),
    ),
    count: slots.length,
  };
}

/** A section's week for reading: subject and teacher in each period. */
export async function loadSectionCells(sectionId: string) {
  const slots = await db.timetableSlot.findMany({ where: { sectionId }, include: { subject: true, teacher: true } });
  return Object.fromEntries(
    slots.map((s) => [slotKey(s.day, s.periodId), { title: s.subject?.name ?? s.label ?? "", sub: s.teacher ? fullName(s.teacher) : undefined }]),
  );
}
