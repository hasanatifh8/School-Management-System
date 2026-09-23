import { BookOpen, Plus, Trash2 } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Table,
  inputClass,
  tbodyClass,
  tdClass,
  thClass,
  theadClass,
  trClass,
} from "@/components/ui";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { createSubject, deleteSubject } from "./actions";

const tileColors = [
  "from-indigo-500 to-violet-500",
  "from-sky-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-violet-500 to-fuchsia-500",
];

/** Stable colour per subject code. */
function tileColor(code: string) {
  const n = [...code].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return tileColors[n % tileColors.length];
}

export default async function SubjectsPage() {
  const school = await getCurrentSchool();
  const subjects = await db.subject.findMany({
    where: { schoolId: school.id },
    orderBy: { name: "asc" },
    include: {
      classes: { include: { class: true }, orderBy: { class: { sortOrder: "asc" } } },
      _count: { select: { students: true, teacherAssignments: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Subjects"
        subtitle="Subjects offered by the school. Add them to a class from the class's page."
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card
          padded={false}
          className="xl:col-span-2"
          title="All subjects"
          description={`${subjects.length} subject(s)`}
        >
          {subjects.length === 0 ? (
            <EmptyState icon={BookOpen} title="No subjects yet" description="Add your first subject using the form." />
          ) : (
            <Table>
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Subject</th>
                  <th className={thClass}>Taught in</th>
                  <th className={thClass}>Students</th>
                  <th className={thClass}>Teachers</th>
                  <th className={thClass}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className={tbodyClass}>
                {subjects.map((s) => (
                  <tr key={s.id} className={trClass}>
                    <td className={tdClass}>
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-9 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br font-mono text-[11px] font-bold text-white shadow-sm ${tileColor(s.code)}`}
                        >
                          {s.code.slice(0, 4)}
                        </span>
                        <div>
                          <div className="font-medium text-slate-900">{s.name}</div>
                          <div className="font-mono text-xs text-slate-400">{s.code}</div>
                        </div>
                      </div>
                    </td>
                    <td className={tdClass}>
                      {s.classes.length ? (
                        <div className="flex max-w-xs flex-wrap gap-1">
                          {s.classes.map((c) => (
                            <Badge key={c.classId}>{c.class.name}</Badge>
                          ))}
                        </div>
                      ) : (
                        <Badge tone="amber" dot>
                          Not in any class
                        </Badge>
                      )}
                    </td>
                    <td className={`${tdClass} tabular-nums`}>{s._count.students}</td>
                    <td className={`${tdClass} tabular-nums`}>{s._count.teacherAssignments}</td>
                    <td className={`${tdClass} text-right`}>
                      <ActionForm
                        action={deleteSubject.bind(null, s.id)}
                        compact
                        className="flex flex-row-reverse flex-wrap items-center justify-start gap-2"
                      >
                        <SubmitButton
                          variant="dangerGhost"
                          size="sm"
                          confirm={`Delete ${s.name}? It will also be removed from class curricula.`}
                          icon={<Trash2 className="h-4 w-4" />}
                        >
                          <span className="sr-only">Delete {s.name}</span>
                        </SubmitButton>
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card title="Add subject" icon={Plus} className="self-start">
          <ActionForm action={createSubject} className="space-y-4">
            <Field label="Subject name" name="name" required>
              <input name="name" required placeholder="e.g. Physics" className={inputClass} />
            </Field>
            <Field label="Code" name="code" required hint="2–10 letters or digits, unique in the school">
              <input name="code" required placeholder="e.g. PHY" className={`${inputClass} font-mono uppercase placeholder:font-sans placeholder:normal-case`} />
            </Field>
            <SubmitButton icon={<Plus className="h-4 w-4" />}>Add subject</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
