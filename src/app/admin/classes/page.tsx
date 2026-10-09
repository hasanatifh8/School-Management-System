import Link from "next/link";
import { ArrowRight, BookOpen, Plus, School, UserCog, Users } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Avatar, Badge, ButtonLink, EmptyState, IconTile, PageHeader, inputClass } from "@/components/ui";
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
        action={
          <>
            <ButtonLink href="/admin/classes/assign" variant="secondary" icon={UserCog}>
              Assign teachers
            </ButtonLink>
            <ButtonLink href="#add-class" icon={Plus} className="lg:hidden">
              Add class
            </ButtonLink>
          </>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Add class: first on phones, a sidebar that stays in view on larger screens */}
        <aside id="add-class" className="scroll-mt-24 lg:sticky lg:top-6 lg:order-2">
          <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
            <div className="flex items-center gap-3">
              <IconTile icon={Plus} tone="indigo" />
              <div>
                <h2 className="font-semibold text-fg">Add a class</h2>
                <p className="text-xs text-muted">You can add sections and subjects next.</p>
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
        </aside>

        <div className="grid items-start gap-6 md:grid-cols-2 lg:order-1 2xl:grid-cols-3">
        {classes.length === 0 && (
          <div className="md:col-span-2 2xl:col-span-3">
            <EmptyState icon={School} title="No classes yet" description="Use the Add a class panel to create your first class." />
          </div>
        )}
        {classes.map((c) => {
          const students = c.sections.reduce((n, s) => n + s._count.students, 0);
          return (
            <article
              key={c.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition hover:border-accent-line hover:shadow-lift"
            >
              <Link href={`/admin/classes/${c.id}`} className="flex items-center gap-4 border-b border-line px-5 py-4">
                <IconTile icon={School} tone="sky" />
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-fg group-hover:text-accent-text">{c.name}</h2>
                  <p className="mt-0.5 flex items-center gap-3 text-xs text-muted">
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
                <ArrowRight className="h-4 w-4 text-subtle transition group-hover:translate-x-0.5 group-hover:text-accent-text" />
              </Link>

              <ul className="flex-1 divide-y divide-line">
                {c.sections.length === 0 && <li className="px-5 py-4 text-sm text-muted">No sections yet.</li>}
                {c.sections.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-sm font-semibold text-fg-2">
                      {s.name}
                    </span>
                    <div className="min-w-0 flex-1">
                      {s.classTeacher ? (
                        <span className="flex items-center gap-2 text-sm text-fg-2">
                          <Avatar name={fullName(s.classTeacher)} src={photoUrl(s.classTeacher.photoId)} size="sm" />
                          <span className="truncate">{fullName(s.classTeacher)}</span>
                        </span>
                      ) : (
                        <Badge tone="amber" dot>
                          No class teacher
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs tabular-nums text-muted">{s._count.students} students</span>
                  </li>
                ))}
              </ul>

              <Link
                href={`/admin/classes/${c.id}`}
                className="border-t border-line bg-surface-2/60 px-5 py-3 text-sm font-medium text-accent-text transition hover:bg-accent-soft/60"
              >
                Manage class
              </Link>
            </article>
          );
        })}

        </div>
      </div>
    </>
  );
}
