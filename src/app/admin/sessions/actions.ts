"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EnrollmentResult } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { autoAssignRollNumbers } from "@/lib/enrollments";
import { getCurrentSchool } from "@/lib/school";
import { ensureNextSession, getCurrentSession, pendingPromotions } from "@/lib/sessions";
import type { ActionState } from "@/lib/action-state";

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
