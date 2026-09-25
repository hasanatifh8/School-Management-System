"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActor } from "@/lib/access";
import { readDocumentUpload } from "@/lib/documents";
import {
  DOCUMENT_LABELS,
  DOCUMENT_TYPES_FOR,
  normalizeDocumentNumber,
  type DocumentOwnerKind,
} from "@/lib/document-types";
import type { ActionState } from "@/lib/action-state";

const uploadSchema = z.object({
  type: z.string(),
  title: z.string().trim().max(120).optional().default(""),
  documentNumber: z.string().max(40).optional().default(""),
});

export async function uploadDocument(
  ownerKind: DocumentOwnerKind,
  ownerId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  // Teachers may add documents only for students in their own class.
  if (actor.kind === "teacher" && (ownerKind !== "student" || !actor.ctx.classSection)) {
    return { error: "You can only add documents for students in your class." };
  }
  const school = actor.kind === "staff" ? actor.school : actor.ctx.school;
  const owner =
    ownerKind === "student"
      ? await db.student.findFirst({
          where: {
            id: ownerId,
            schoolId: school.id,
            ...(actor.kind === "teacher" && { sectionId: actor.ctx.classSection!.id, status: "ACTIVE" as const }),
          },
          select: { id: true },
        })
      : await db.teacher.findFirst({ where: { id: ownerId, schoolId: school.id }, select: { id: true } });
  if (!owner) return { error: `${ownerKind === "student" ? "Student" : "Teacher"} not found.` };

  const parsed = uploadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid form data." };
  const type = DOCUMENT_TYPES_FOR[ownerKind].find((t) => t === parsed.data.type);
  if (!type) return { error: "Choose a document type.", fieldErrors: { type: ["Choose a document type"] } };

  const number = normalizeDocumentNumber(type, parsed.data.documentNumber);
  if ("error" in number) return { error: number.error, fieldErrors: { documentNumber: [number.error] } };

  const upload = await readDocumentUpload(formData);
  if ("error" in upload) return { error: upload.error, fieldErrors: { file: [upload.error] } };
  const { data, ...file } = upload.file;

  const title = parsed.data.title || DOCUMENT_LABELS[type];
  // A single nested write is atomic without an interactive transaction, whose
  // 5 s timeout a multi-MB upload to a remote database can exceed.
  await db.document.create({
    data: {
      ...file,
      school: { connect: { id: school.id } },
      ...(ownerKind === "student"
        ? { student: { connect: { id: owner.id } } }
        : { teacher: { connect: { id: owner.id } } }),
      type,
      title,
      documentNumber: number.value,
      file: { create: { data } },
    },
    select: { id: true },
  });

  revalidatePath("/", "layout");
  return { ok: true, message: `Uploaded “${title}”.` };
}

export async function deleteDocument(documentId: string): Promise<ActionState> {
  const actor = await getActor();
  const school = actor.kind === "staff" ? actor.school : actor.ctx.school;
  const document = await db.document.findFirst({
    where: {
      id: documentId,
      schoolId: school.id,
      // Teachers: only documents of students in their own class.
      ...(actor.kind === "teacher" && {
        student: { sectionId: actor.ctx.classSection?.id ?? "-", status: "ACTIVE" as const },
      }),
    },
    select: { fileId: true, title: true },
  });
  if (!document) return { error: "Document not found." };

  // Deleting the file cascades to the document row.
  await db.documentFile.delete({ where: { id: document.fileId } });
  revalidatePath("/", "layout");
  return { ok: true, message: `Deleted “${document.title}”.` };
}
