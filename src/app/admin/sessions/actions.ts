"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EnrollmentResult } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { autoAssignRollNumbers } from "@/lib/enrollments";
import { getCurrentSchool } from "@/lib/school";
import { ensureNextSession, getCurrentSession, pendingPromotions } from "@/lib/sessions";
import type { ActionState } from "@/lib/action-state";
import { isoDate, parseISODate, todayISO } from "@/lib/attendance-shared";

// Promotion writes many rows; allow more than Prisma's 5 s default.
const LONG_TX = { timeout: 60_000, maxWait: 10_000 };

/** Creates the next session (e.g. 2027-28) so promotion can begin. */
export async function beginPromotion(): Promise<ActionState> {
  const school = await getCurrentSchool();
  const current = await getCurrentSession(school.id);
  const next = await db.$transaction((tx) => ensureNextSession(tx, school.id, current));
  revalidatePath("/admin", "layout");
  return { ok: true, message: `Session ${next.name} is ready. Promote each class below.` };
}

type Decision =
  | { result: "PROMOTED" | "DETAINED"; sectionId: string }
  | { result: "LEFT" | "PASSED_OUT" };

function parseDecision(raw: FormDataEntryValue | null): Decision | null {
  const value = String(raw ?? "");
  const [kind, sectionId] = value.split(":");
  if (kind === "promote" && sectionId) return { result: "PROMOTED", sectionId };
  if (kind === "repeat" && sectionId) return { result: "DETAINED", sectionId };
  if (kind === "left") return { result: "LEFT" };
  if (kind === "passed") return { result: "PASSED_OUT" };
  return null;
}

/**
 * Records the year-end decision for every active student in a class and
 * places promoted/repeating students in the next session (created if needed).
 * Students keep their current class until the next session is started.
 */
export async function promoteClass(classId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const schoolClass = await db.schoolClass.findFirst({ where: { id: classId, schoolId: school.id } });
  if (!schoolClass) return { error: "Class not found." };

  const current = await getCurrentSession(school.id);
  const [students, validSections] = await Promise.all([
    db.student.findMany({
      where: { schoolId: school.id, status: "ACTIVE", section: { classId } },
      select: { id: true, sectionId: true, rollNumber: true },
    }),
    db.section.findMany({ where: { class: { schoolId: school.id } }, select: { id: true } }),
  ]);
  if (!students.length) return { error: "This class has no active students to promote." };
  const sectionIds = new Set(validSections.map((s) => s.id));

  const decisions = new Map<string, Decision>();
  for (const s of students) {
    const d = parseDecision(formData.get(`decision:${s.id}`));
    if (!d || ("sectionId" in d && !sectionIds.has(d.sectionId))) {
      return { error: "Choose what happens to every student." };
    }
    decisions.set(s.id, d);
  }

  const next = await db.$transaction(async (tx) => {
    const nextSession = await ensureNextSession(tx, school.id, current);
    for (const s of students) {
      const d = decisions.get(s.id)!;
      // This year's outcome.
      await tx.enrollment.upsert({
        where: { sessionId_studentId: { sessionId: current.id, studentId: s.id } },
        create: { sessionId: current.id, studentId: s.id, sectionId: s.sectionId!, rollNumber: s.rollNumber, result: d.result },
        update: { result: d.result },
      });
      // Next year's class (roll numbers are assigned when the session starts).
      if ("sectionId" in d) {
        await tx.enrollment.upsert({
          where: { sessionId_studentId: { sessionId: nextSession.id, studentId: s.id } },
          create: { sessionId: nextSession.id, studentId: s.id, sectionId: d.sectionId },
          update: { sectionId: d.sectionId, rollNumber: null },
        });
      } else {
        await tx.enrollment.deleteMany({ where: { sessionId: nextSession.id, studentId: s.id } });
      }
    }
    return nextSession;
  }, LONG_TX);

  const counts = { PROMOTED: 0, DETAINED: 0, LEFT: 0, PASSED_OUT: 0 } satisfies Record<EnrollmentResult, number>;
  for (const d of decisions.values()) counts[d.result]++;
  const parts = [
    counts.PROMOTED && `${counts.PROMOTED} promoted`,
    counts.DETAINED && `${counts.DETAINED} repeating`,
    counts.LEFT && `${counts.LEFT} leaving`,
    counts.PASSED_OUT && `${counts.PASSED_OUT} passed out`,
  ].filter(Boolean);

  revalidatePath("/admin", "layout");
  return { ok: true, message: `${schoolClass.name} saved for ${next.name}: ${parts.join(", ")}.` };
}

/**
 * Makes the upcoming session current: moves every student into next year's
 * class, marks leavers inactive, numbers each section A–Z from 1 and closes
 * the old session.
 */
export async function startNextSession(sessionId: string): Promise<ActionState> {
  const school = await getCurrentSchool();
  const current = await getCurrentSession(school.id);
  const next = await db.academicSession.findFirst({
    where: { id: sessionId, schoolId: school.id, status: "UPCOMING" },
  });
  if (!next) return { error: "That session can't be started." };

  const pending = await pendingPromotions(school.id, current.id);
  if (pending.length) {
    return {
      error: `Promote these classes first: ${pending.map((p) => `${p.name} (${p.count} left)`).join(", ")}.`,
    };
  }

  await db.$transaction(async (tx) => {
    // Leavers and pass-outs become inactive (their records and history are kept).
    const leaving = await tx.enrollment.findMany({
      where: { sessionId: current.id, result: { in: ["LEFT", "PASSED_OUT"] } },
      select: { studentId: true },
    });
    await tx.student.updateMany({
      where: { id: { in: leaving.map((e) => e.studentId) } },
      data: { status: "INACTIVE", rollNumber: null },
    });

    // Everyone else moves into next year's class.
    const moves = await tx.enrollment.findMany({
      where: { sessionId: next.id },
      select: {
        studentId: true,
        sectionId: true,
        section: { select: { classId: true, class: { select: { subjects: { select: { subjectId: true } } } } } },
        student: { select: { section: { select: { classId: true } } } },
      },
    });
    for (const m of moves) {
      await tx.student.update({
        where: { id: m.studentId },
        data: { sectionId: m.sectionId, rollNumber: null, status: "ACTIVE" },
      });
      // A new class brings its own subjects; repeating students keep theirs.
      if (m.student.section?.classId !== m.section.classId) {
        await tx.studentSubject.deleteMany({ where: { studentId: m.studentId } });
        await tx.studentSubject.createMany({
          data: m.section.class.subjects.map((s) => ({ studentId: m.studentId, subjectId: s.subjectId })),
        });
      }
    }

    // Fresh roll numbers for the new year.
    for (const sectionId of new Set(moves.map((m) => m.sectionId))) {
      await autoAssignRollNumbers(tx, next.id, sectionId, "all");
    }

    await tx.academicSession.update({ where: { id: current.id }, data: { status: "CLOSED" } });
    await tx.academicSession.update({ where: { id: next.id }, data: { status: "CURRENT" } });
  }, { timeout: 120_000, maxWait: 10_000 });

  revalidatePath("/admin", "layout");
  redirect("/admin/sessions?started=1");
}

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const show = (iso: string) => dateFormat.format(parseISODate(iso)!);

/**
 * Changes a session's start and end dates. Every attendance day, fee receipt
 * and exam paper must stay inside the session, and sessions can't overlap.
 */
export async function updateSessionDates(sessionId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const session = await db.academicSession.findFirst({ where: { id: sessionId, schoolId: school.id, status: { not: "CLOSED" } } });
  if (!session) return { error: "Only the current or upcoming session can be changed." };

  const start = String(formData.get("startDate") ?? "");
  const end = String(formData.get("endDate") ?? "");
  if (!parseISODate(start)) return { error: "Choose the start date.", fieldErrors: { startDate: ["Required"] } };
  if (!parseISODate(end)) return { error: "Choose the end date.", fieldErrors: { endDate: ["Required"] } };
  if (end <= start) return { error: "The end date must be after the start date.", fieldErrors: { endDate: ["After the start date"] } };
  const months = (Number(end.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(end.slice(5, 7)) - Number(start.slice(5, 7));
  if (months < 5 || months > 17) return { error: "A session should last between 6 and 18 months.", fieldErrors: { endDate: ["6–18 months after the start"] } };

  const today = todayISO();
  if (session.status === "CURRENT") {
    if (start > today) return { error: "The current session must have started by today.", fieldErrors: { startDate: [`On or before ${show(today)}`] } };
    if (end < today) {
      return { error: "The current session can't end before today. To move on, promote classes and start the next session.", fieldErrors: { endDate: [`On or after ${show(today)}`] } };
    }
  }

  // Neighbouring sessions.
  const [before, after] = await Promise.all([
    db.academicSession.findFirst({ where: { schoolId: school.id, id: { not: session.id }, startDate: { lt: session.startDate } }, orderBy: { startDate: "desc" } }),
    db.academicSession.findFirst({ where: { schoolId: school.id, id: { not: session.id }, startDate: { gt: session.startDate } }, orderBy: { startDate: "asc" } }),
  ]);
  if (before && start <= isoDate(before.endDate)) {
    return { error: `${session.name} must start after ${before.name} ends (${show(isoDate(before.endDate))}).`, fieldErrors: { startDate: ["Overlaps the previous session"] } };
  }
  if (after && end >= isoDate(after.startDate)) {
    return { error: `${session.name} must end before ${after.name} starts (${show(isoDate(after.startDate))}). Change ${after.name}'s dates first.`, fieldErrors: { endDate: ["Overlaps the next session"] } };
  }

  // Records already kept in this session must stay inside it.
  const [days, receipts, papers] = await Promise.all([
    db.attendanceDay.aggregate({
      where: { schoolId: school.id, date: { gte: session.startDate, lte: session.endDate } },
      _min: { date: true },
      _max: { date: true },
    }),
    db.feeReceipt.aggregate({ where: { sessionId: session.id }, _min: { date: true }, _max: { date: true }, _count: true }),
    db.examPaper.aggregate({ where: { exam: { sessionId: session.id } }, _min: { date: true }, _max: { date: true } }),
  ]);
  const records = [
    { what: "Attendance", min: days._min.date, max: days._max.date },
    { what: "A fee receipt", min: receipts._min.date, max: receipts._max.date },
    { what: "An exam paper", min: papers._min.date, max: papers._max.date },
  ];
  for (const r of records) {
    if (r.min && start > isoDate(r.min)) {
      return { error: `${r.what} is recorded on ${show(isoDate(r.min))}, so the session must start on or before that day.`, fieldErrors: { startDate: [`On or before ${show(isoDate(r.min))}`] } };
    }
    if (r.max && end < isoDate(r.max)) {
      return { error: `${r.what} is recorded on ${show(isoDate(r.max))}, so the session must end on or after that day.`, fieldErrors: { endDate: [`On or after ${show(isoDate(r.max))}`] } };
    }
  }
  // Fee instalments (monthly, quarterly…) count from the start month, so it
  // can't move once fees have been collected.
  if (receipts._count && start.slice(0, 7) !== isoDate(session.startDate).slice(0, 7)) {
    return {
      error: `Fees have already been collected for ${session.name}, so the start month can't change (instalments count from it). You can still change the day.`,
      fieldErrors: { startDate: [`Keep it in ${dateFormat.format(session.startDate).split(" ").slice(1).join(" ")}`] },
    };
  }

  await db.academicSession.update({ where: { id: session.id }, data: { startDate: parseISODate(start)!, endDate: parseISODate(end)! } });
  revalidatePath("/admin", "layout");
  return { ok: true, message: `${session.name} now runs ${show(start)} – ${show(end)}.` };
}
