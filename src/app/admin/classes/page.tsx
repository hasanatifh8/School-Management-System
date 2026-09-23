import Link from "next/link";
import { ArrowRight, BookOpen, Plus, School, Users } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Avatar, Badge, EmptyState, IconTile, PageHeader, inputClass } from "@/components/ui";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { photoUrl } from "@/lib/photos";
import { fullName } from "@/lib/queries";
import { createClass } from "./actions";

export default async function ClassesPage() {
  const school = await getCurrentSchool();
  const classes = await db.schoolClass.findMany({
    where: { schoolId: school.id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      sections: {
        orderBy: { name: "asc" },
        include: {
          classTeacher: true,
          _count: { select: { students: { where: { status: "ACTIVE" } } } },
        },
      },
      _count: { select: { subjects: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Classes"
        subtitle="Sections, curriculum, class teachers and subject teachers"
      />

      <div className="grid items-start gap-6 md:grid-cols-2 2xl:grid-cols-3">
        {classes.map((c) => {
          const students = c.sections.reduce((n, s) => n + s._count.students, 0);
          return (
            <article
              key={c.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_-8px_rgba(15,23,42,0.08)] transition hover:border-indigo-200 hover:shadow-md"
            >
              <Link href={`/admin/classes/${c.id}`} className="flex items-center gap-4 border-b border-slate-100 px-5 py-4">
                <IconTile icon={School} tone="sky" />
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-slate-900 group-hover:text-indigo-600">{c.name}</h2>
                  <p className="mt-0.5 flex items-center gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {students} students
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5" />
                      {c._count.subjects} subjects
                    </span>
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
              </Link>

              <ul className="flex-1 divide-y divide-slate-100">
                {c.sections.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">No sections yet.</li>}
                {c.sections.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-700">
                      {s.name}
                    </span>
                    <div className="min-w-0 flex-1">
                      {s.classTeacher ? (
                        <span className="flex items-center gap-2 text-sm text-slate-700">
                          <Avatar name={fullName(s.classTeacher)} src={photoUrl(s.classTeacher.photoId)} size="sm" />
                          <span className="truncate">{fullName(s.classTeacher)}</span>
                        </span>
                      ) : (
                        <Badge tone="amber" dot>
                          No class teacher
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs tabular-nums text-slate-500">{s._count.students} students</span>
                  </li>
                ))}
              </ul>

              <Link
                href={`/admin/classes/${c.id}`}
                className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50/60"
              >
                Manage class
              </Link>
            </article>
          );
        })}

        {/* Add class */}
        <section className="flex flex-col rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 p-6">
          <div className="flex items-center gap-3">
            <IconTile icon={Plus} tone="indigo" />
            <div>
              <h2 className="font-semibold text-slate-900">Add a class</h2>
              <p className="text-xs text-slate-500">You can add sections and subjects next.</p>
            </div>
          </div>
          <ActionForm action={createClass} className="mt-5 space-y-4">
            <Field label="Class name" name="name" required>
              <input name="name" required placeholder="e.g. Class 6" className={inputClass} />
            </Field>
            <Field label="Sections" name="sections" hint="Comma-separated, e.g. A, B, C">
              <input name="sections" placeholder="A, B, C" defaultValue="A" className={inputClass} />
            </Field>
            <SubmitButton icon={<Plus className="h-4 w-4" />}>Create class</SubmitButton>
          </ActionForm>
        </section>
      </div>

      {classes.length === 0 && (
        <div className="mt-6">
          <EmptyState icon={School} title="No classes yet" description="Use the form above to create your first class." />
        </div>
      )}
    </>
  );
}
