"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, Crown, Plus, X } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, selectClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

export type SectionChoice = {
  id: string;
  classId: string;
  label: string;
  /** Its class teacher now, if any. */
  classTeacher: { id: string; name: string } | null;
  /** The class's subjects, each with who teaches it in this section now. */
  subjects: { id: string; name: string; teacher: { id: string; name: string } | null }[];
};

/**
 * A teacher's classes and subjects, managed from their profile: the sections
 * they are class teacher of, and every subject they teach in each section.
 * Add or remove either here; a section or subject taken from someone else says so.
 */
export function TeachingCard({
  teacherId,
  sections,
  addClass,
  removeClass,
  addSubject,
  removeSubject,
}: {
  teacherId: string;
  sections: SectionChoice[];
  addClass: Action;
  removeClass: (sectionId: string) => Promise<ActionState>;
  addSubject: Action;
  removeSubject: (sectionId: string, subjectId: string) => Promise<ActionState>;
}) {
  const [pickSection, setPickSection] = useState("");
  const classOf = sections.filter((s) => s.classTeacher?.id === teacherId);
  const notClassOf = sections.filter((s) => s.classTeacher?.id !== teacherId);
  // Subjects they teach, each with its sections.
  const taught = new Map<string, { name: string; at: { section: SectionChoice }[] }>();
  for (const sec of sections)
    for (const sub of sec.subjects)
      if (sub.teacher?.id === teacherId) {
        const entry = taught.get(sub.id) ?? { name: sub.name, at: [] };
        entry.at.push({ section: sec });
        taught.set(sub.id, entry);
      }
  const chosen = sections.find((s) => s.id === pickSection);
  const openSubjects = chosen?.subjects.filter((s) => s.teacher?.id !== teacherId) ?? [];

  return (
    <Card title="Classes & subjects" icon={BookOpen} description="What this teacher looks after. Changes here show on each class's page too.">
      <div className="space-y-6">
        {/* Class teacher of */}
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-fg-2">
            <Crown className="h-4 w-4 text-accent-text" /> Class teacher of
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {classOf.length === 0 && <span className="text-sm text-muted">No class yet.</span>}
            {classOf.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-1 pl-3 pr-1 text-sm font-medium text-accent-text">
                <Link href={`/admin/classes/${s.classId}`} className="hover:underline">
                  {s.label}
                </Link>
                <ActionForm action={() => removeClass(s.id)} compact className="inline-flex">
                  <SubmitButton variant="ghost" size="sm" confirm={`Remove as class teacher of ${s.label}?`} className="!h-6 !w-6 !rounded-full !px-0">
                    <X className="h-3.5 w-3.5" />
                    <span className="sr-only">Remove {s.label}</span>
                  </SubmitButton>
                </ActionForm>
              </span>
            ))}
          </div>
          {notClassOf.length > 0 && (
            <ActionForm action={addClass} compact className="mt-3 flex flex-wrap items-center gap-2">
              <select name="sectionId" defaultValue="" className={`${selectClass} !w-72 !py-1.5`}>
                <option value="" disabled>
                  Add a class…
                </option>
                {notClassOf.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                    {s.classTeacher ? ` (replaces ${s.classTeacher.name})` : ""}
                  </option>
                ))}
              </select>
              <SubmitButton variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />}>
                Add
              </SubmitButton>
            </ActionForm>
          )}
        </section>

        {/* Subjects taught */}
        <section className="border-t border-line pt-5">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-fg-2">
            <BookOpen className="h-4 w-4 text-accent-text" /> Subjects taught
          </h3>
          {taught.size === 0 ? (
            <p className="text-sm text-muted">No subjects yet.</p>
          ) : (
            <ul className="space-y-2">
              {[...taught].map(([subjectId, t]) => (
                <li key={subjectId} className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2">
                  <span className="mr-1 font-medium text-fg">{t.name}</span>
                  <Badge>{t.at.length} section{t.at.length === 1 ? "" : "s"}</Badge>
                  <span className="flex flex-wrap gap-1.5">
                    {t.at.map(({ section }) => (
                      <span key={section.id} className="inline-flex items-center gap-0.5 rounded-full bg-surface-3 py-0.5 pl-2.5 pr-0.5 text-xs font-medium text-fg-2">
                        {section.label}
                        <ActionForm action={() => removeSubject(section.id, subjectId)} compact className="inline-flex">
                          <SubmitButton variant="ghost" size="sm" confirm={`Take ${t.name} in ${section.label} off this teacher?`} className="!h-5 !w-5 !rounded-full !px-0">
                            <X className="h-3 w-3" />
                            <span className="sr-only">Remove {t.name} in {section.label}</span>
                          </SubmitButton>
                        </ActionForm>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <ActionForm action={addSubject} compact className="mt-3 flex flex-wrap items-center gap-2">
            <select name="sectionId" value={pickSection} onChange={(e) => setPickSection(e.target.value)} className={`${selectClass} !w-44 !py-1.5`}>
              <option value="">Class…</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <select key={pickSection} name="subjectId" defaultValue="" disabled={!chosen} className={`${selectClass} !w-64 !py-1.5`}>
              <option value="" disabled>
                {!chosen ? "Subject…" : openSubjects.length ? "Subject…" : "All its subjects are theirs"}
              </option>
              {openSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.teacher ? ` (now ${s.teacher.name})` : " (unassigned)"}
                </option>
              ))}
            </select>
            <SubmitButton variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />}>
              Assign
            </SubmitButton>
          </ActionForm>
        </section>
      </div>
    </Card>
  );
}
