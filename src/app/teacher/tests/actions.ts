"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { db } from "@/lib/db";
import {
  canEdit,
  createExamRecord,
  loadExam,
  saveTimetableRecord,
  savePrintSettingsRecord,
  teacherActor,
  teacherCanView,
  updateExamDetailsRecord,
} from "@/lib/exams";
import type { PrintSettings } from "@/lib/exams-shared";
import { publishResultsRecord, saveMarksRecord, unpublishResultsRecord } from "@/lib/exam-marks";
import { getCurrentSession } from "@/lib/sessions";
import { requireTeacher } from "@/lib/teacher-auth";

const revalidate = () => {
  revalidatePath("/teacher", "layout");
  revalidatePath("/admin/exams", "layout");
};

/** One of the signed-in teacher's own tests, loaded for editing, or null. */
async function ownTest(id: string) {
  const ctx = await requireTeacher();
  const actor = teacherActor(ctx);
  const exam = await loadExam(ctx.school.id, id);
  return exam && canEdit(actor, exam) ? { actor, exam } : null;
}

export async function createTest(_: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireTeacher();
  const session = await getCurrentSession(ctx.school.id);
  const result = await createExamRecord(teacherActor(ctx), session.id, formData);
  if (!result.id) return result.state!;
  revalidate();
  redirect(`/teacher/tests/${result.id}`);
}

export async function updateTestDetails(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const own = await ownTest(id);
  if (!own) return { error: "You can only change your own tests." };
  const state = await updateExamDetailsRecord(own.actor, own.exam, formData);
  if (state.ok) revalidate();
  return state;
}

export async function saveTestTimetable(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const own = await ownTest(id);
  if (!own) return { error: "You can only change your own tests." };
  const state = await saveTimetableRecord(own.actor, own.exam, formData);
  if (state.ok) revalidate();
  return state;
}

export async function saveTestPrintSettings(id: string, settings: PrintSettings): Promise<ActionState> {
  const own = await ownTest(id);
  if (!own) return { error: "You can only change your own tests." };
  await savePrintSettingsRecord(own.exam.id, settings);
  revalidate();
  return { ok: true, message: "Saved as default." };
}

export async function deleteTest(id: string): Promise<ActionState> {
  const own = await ownTest(id);
  if (!own) return { error: "You can only delete your own tests." };
  await db.exam.delete({ where: { id: own.exam.id } });
  revalidate();
  redirect("/teacher/tests");
}

/* ───────────────────────── Marks & results ───────────────────────── */

/** An exam or test the teacher may open (marks access is checked per section). */
async function visibleExam(id: string) {
  const ctx = await requireTeacher();
  const exam = await loadExam(ctx.school.id, id);
  return exam && teacherCanView(ctx, exam) ? { actor: teacherActor(ctx), exam } : null;
}

export async function saveTeacherMarks(id: string, sectionId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const found = await visibleExam(id);
  if (!found) return { error: "Exam not found." };
  const state = await saveMarksRecord(found.actor, found.exam, sectionId, formData);
  if (state.ok) revalidate();
  return state;
}

export async function publishTeacherResults(id: string, sectionId: string): Promise<ActionState> {
  const found = await visibleExam(id);
  if (!found) return { error: "Exam not found." };
  const state = await publishResultsRecord(found.actor, found.exam, sectionId);
  if (state.ok) revalidate();
  return state;
}

export async function unpublishTeacherResults(id: string, sectionId: string): Promise<ActionState> {
  const found = await visibleExam(id);
  if (!found) return { error: "Exam not found." };
  const state = await unpublishResultsRecord(found.actor, found.exam, sectionId);
  if (state.ok) revalidate();
  return state;
}
