"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { db } from "@/lib/db";
import {
  createExamRecord,
  loadExam,
  saveTimetableRecord,
  savePrintSettingsRecord,
  updateExamDetailsRecord,
  type ExamActor,
} from "@/lib/exams";
import type { PrintSettings } from "@/lib/exams-shared";
import { publishResultsRecord, saveMarksRecord, unpublishResultsRecord } from "@/lib/exam-marks";
import { getCurrentSchool, getViewer } from "@/lib/school";
import { getCurrentSession } from "@/lib/sessions";
import { logActivity, logged } from "@/lib/activity";

/** The signed-in admin (or Power Admin) working on exams. */
async function adminActor(): Promise<ExamActor> {
  const school = await getCurrentSchool();
  const viewer = await getViewer();
  return { kind: "admin", schoolId: school.id, who: viewer?.kind === "admin" ? viewer.admin.name : "Power Admin" };
}

const revalidate = () => {
  revalidatePath("/admin/exams", "layout");
  revalidatePath("/teacher", "layout");
};

export async function createExam(_: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const session = await getCurrentSession(actor.schoolId);
  const result = await createExamRecord(actor, session.id, formData);
  if (!result.id) return result.state!;
  await logActivity("Exams", `Created exam ${String(formData.get("name") ?? "").trim()}`);
  revalidate();
  redirect(`/admin/exams/${result.id}`);
}

export async function updateExamDetails(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const exam = await loadExam(actor.schoolId, id);
  if (!exam) return { error: "Exam not found." };
  const state = await updateExamDetailsRecord(actor, exam, formData);
  if (state.ok) revalidate();
  return state;
}

export async function saveExamTimetable(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const exam = await loadExam(actor.schoolId, id);
  if (!exam) return { error: "Exam not found." };
  const state = await saveTimetableRecord(actor, exam, formData);
  if (state.ok) revalidate();
  return state;
}

export async function setExamPublished(id: string, published: boolean): Promise<ActionState> {
  const actor = await adminActor();
  const exam = await db.exam.findFirst({ where: { id, schoolId: actor.schoolId, kind: "EXAM" }, select: { name: true } });
  if (!exam) return { error: "Exam not found." };
  await db.exam.update({ where: { id }, data: { published } });
  revalidate();
  return logged(
    "Exams",
    { ok: true, message: published ? "Published. Teachers of these classes can now see and print it." : "Moved back to draft. Teachers can no longer see it." },
    `${published ? "Published" : "Unpublished"} exam ${exam.name}`,
  );
}

export async function saveExamPrintSettings(id: string, settings: PrintSettings): Promise<ActionState> {
  const actor = await adminActor();
  const exam = await db.exam.findFirst({ where: { id, schoolId: actor.schoolId }, select: { id: true } });
  if (!exam) return { error: "Exam not found." };
  await savePrintSettingsRecord(exam.id, settings);
  revalidate();
  return { ok: true, message: "Saved as default." };
}

export async function deleteExam(id: string): Promise<ActionState> {
  const actor = await adminActor();
  const exam = await db.exam.findFirst({ where: { id, schoolId: actor.schoolId }, select: { id: true, kind: true, name: true } });
  if (!exam) return { error: "Exam not found." };
  await db.exam.delete({ where: { id } });
  await logActivity("Exams", `Deleted ${exam.kind === "TEST" ? "test" : "exam"} ${exam.name}`);
  revalidate();
  redirect(exam.kind === "TEST" ? "/admin/exams?kind=tests" : "/admin/exams");
}

/* ───────────────────────── Marks & results ───────────────────────── */

export async function saveExamMarks(id: string, sectionId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const exam = await loadExam(actor.schoolId, id);
  if (!exam) return { error: "Exam not found." };
  const state = await saveMarksRecord(actor, exam, sectionId, formData);
  if (state.ok) revalidate();
  return state;
}

export async function publishExamResults(id: string, sectionId: string): Promise<ActionState> {
  const actor = await adminActor();
  const exam = await loadExam(actor.schoolId, id);
  if (!exam) return { error: "Exam not found." };
  const state = await publishResultsRecord(actor, exam, sectionId);
  if (state.ok) revalidate();
  return state;
}

export async function unpublishExamResults(id: string, sectionId: string): Promise<ActionState> {
  const actor = await adminActor();
  const exam = await loadExam(actor.schoolId, id);
  if (!exam) return { error: "Exam not found." };
  const state = await unpublishResultsRecord(actor, exam, sectionId);
  if (state.ok) revalidate();
  return state;
}
