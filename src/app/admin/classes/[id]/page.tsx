import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Crown, Hash, Layers, Plus, Rocket, Trash2, Users } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import {
  Badge,
  ButtonLink,
  Card,
  IconTile,
  PageHeader,
  checkboxClass,
  inputClass,
  selectClass,
  tbodyClass,
  tdClass,
  thClass,
  theadClass,
} from "@/components/ui";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { fullName, sectionLabel } from "@/lib/queries";
import {
  addSection,
  assignClassTeacher,
  assignRollNumbers,
  assignSubjectTeacher,
  deleteClass,
  deleteSection,
  setClassSubjects,
} from "../actions";

export default async function ClassPage({ params }: PageProps<"/admin/classes/[id]">) {
  const { id } = await params;
  const school = await getCurrentSchool();
  const [schoolClass, allSubjects, teachers] = await Promise.all([
    db.schoolClass.findFirst({
      where: { id, schoolId: school.id },
      include: {
        subjects: { include: { subject: true }, orderBy: { subject: { name: "asc" } } },
        sections: {
          orderBy: { name: "asc" },
          include: {
            subjectAssignments: true,
            students: { where: { status: "ACTIVE" }, select: { rollNumber: true } },
            _count: { select: { students: { where: { status: "ACTIVE" } } } },
          },
        },
      },
    }),
    db.subject.findMany({ where: { schoolId: school.id }, orderBy: { name: "asc" } }),
    db.teacher.findMany({
      where: { schoolId: school.id, status: "ACTIVE" },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      include: { classTeacherOf: { include: { class: true } } },
    }),
  ]);
  if (!schoolClass) notFound();

  const curriculum = schoolClass.subjects.map((cs) => cs.subject);
  const curriculumIds = new Set(curriculum.map((s) => s.id));
  const studentCount = schoolClass.sections.reduce((n, s) => n + s._count.students, 0);

  return (
    <>
      <PageHeader
        title={schoolClass.name}
        breadcrumbs={[{ label: "Classes", href: "/admin/classes" }, { label: schoolClass.name }]}
        subtitle="Manage sections, curriculum and teacher assignments."
        action={
          <>
          <ButtonLink href={`/admin/classes/${schoolClass.id}/promote`} icon={Rocket}>
            Promote class
          </ButtonLink>
          <ActionForm action={deleteClass.bind(null, schoolClass.id)} compact className="flex flex-row-reverse items-center gap-3">
            <SubmitButton
              variant="dangerGhost"
              confirm={`Delete ${schoolClass.name} and all its sections? This only works when the class has no students.`}
              icon={<Trash2 className="h-4 w-4" />}
            >
              Delete class
            </SubmitButton>
          </ActionForm>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <MiniStat icon={Layers} tone="sky" label="Sections" value={schoolClass.sections.length} />
        <MiniStat icon={Users} tone="indigo" label="Active students" value={studentCount} />
        <MiniStat icon={BookOpen} tone="violet" label="Subjects" value={curriculum.length} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {schoolClass.sections.length === 0 && (
            <Card>
              <p className="text-sm text-slate-500">
                This class has no sections yet. Add one to assign teachers and students.
              </p>
            </Card>
          )}

          {schoolClass.sections.map((section) => {
            const label = sectionLabel({ ...section, class: schoolClass });
            const assignedBySubject = new Map(section.subjectAssignments.map((a) => [a.subjectId, a.teacherId]));
            const unassigned = curriculum.filter((s) => !assignedBySubject.has(s.id)).length;
            return (
              <section
                key={section.id}
                className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_-8px_rgba(15,23,42,0.08)]"
              >
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-base font-semibold text-white shadow-sm shadow-indigo-500/30">
                      {section.name}
                    </span>
                    <div>
                      <h2 className="font-semibold text-slate-900">Section {section.name}</h2>
                      <Link
                        href={`/admin/students?classId=${schoolClass.id}`}
                        className="text-xs text-slate-500 hover:text-indigo-600"
                      >
                        {section._count.students} active students
                      </Link>
                    </div>
                  </div>
                  <ActionForm action={deleteSection.bind(null, section.id)} compact className="flex flex-row-reverse items-center gap-3">
                    <SubmitButton variant="ghost" size="sm" confirm={`Delete ${label}?`} icon={<Trash2 className="h-4 w-4" />}>
                      Delete section
                    </SubmitButton>
                  </ActionForm>
                </header>

                {/* Roll numbers */}
                {section._count.students > 0 && (
                  <RollNumberBar
                    sectionId={section.id}
                    label={label}
                    total={section._count.students}
                    missing={section.students.filter((s) => s.rollNumber == null).length}
                  />
                )}

                {/* Class teacher */}
                <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50/60 to-transparent px-6 py-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Crown className="h-4 w-4 text-indigo-500" />
                    Class teacher
                  </div>
                  <ActionForm
                    syncKey={section.classTeacherId ?? ""}
                    action={assignClassTeacher.bind(null, section.id)}
                    compact
                    className="flex flex-wrap items-center gap-2"
                  >
                    <select
                      name="teacherId"
                      defaultValue={section.classTeacherId ?? ""}
                      className={`${selectClass} max-w-sm !py-2`}
                    >
                      <option value="">— No class teacher —</option>
                      {teachers.map((t) => {
                        const elsewhere = t.classTeacherOf && t.classTeacherOf.id !== section.id;
                        return (
                          <option key={t.id} value={t.id} disabled={!!elsewhere}>
                            {fullName(t)} ({t.employeeCode})
                            {elsewhere ? ` — class teacher of ${sectionLabel(t.classTeacherOf!)}` : ""}
                          </option>
                        );
                      })}
                    </select>
                    <SubmitButton variant="secondary" size="sm">
                      Save
                    </SubmitButton>
                  </ActionForm>
                </div>

                {/* Subject teachers */}
                <div className="flex items-center justify-between px-6 pb-2 pt-4">
                  <h3 className="text-sm font-medium text-slate-700">Subject teachers</h3>
                  {curriculum.length > 0 &&
                    (unassigned ? (
                      <Badge tone="amber" dot>
                        {unassigned} unassigned
                      </Badge>
                    ) : (
                      <Badge tone="green" dot>
                        All assigned
                      </Badge>
                    ))}
                </div>
                {curriculum.length === 0 ? (
                  <p className="px-6 pb-5 text-sm text-slate-500">Add subjects to this class&apos;s curriculum first.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className={theadClass}>
                        <tr>
                          <th className={thClass}>Subject</th>
                          <th className={thClass}>Teacher</th>
                        </tr>
                      </thead>
                      <tbody className={tbodyClass}>
                        {curriculum.map((subject) => {
                          const current = assignedBySubject.get(subject.id) ?? "";
                          return (
                            <tr key={subject.id}>
                              <td className={`${tdClass} w-1/3`}>
                                <div className="font-medium text-slate-800">{subject.name}</div>
                                <div className="font-mono text-[11px] text-slate-400">{subject.code}</div>
                              </td>
                              <td className={tdClass}>
                                <ActionForm
                                  syncKey={current}
                                  action={assignSubjectTeacher.bind(null, section.id, subject.id)}
                                  compact
                                  className="flex flex-wrap items-center gap-2"
                                >
                                  <select
                                    name="teacherId"
                                    defaultValue={current}
                                    className={`${selectClass} max-w-xs !py-2 ${current ? "" : "!border-amber-300 !bg-amber-50/40"}`}
                                  >
                                    <option value="">— Not assigned —</option>
                                    {teachers.map((t) => (
                                      <option key={t.id} value={t.id}>
                                        {fullName(t)} ({t.employeeCode})
                                      </option>
                                    ))}
                                  </select>
                                  <SubmitButton variant="secondary" size="sm">
                                    Save
                                  </SubmitButton>
                                </ActionForm>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <div className="space-y-6 self-start">
          <Card
            title="Curriculum"
            icon={BookOpen}
            description="Subjects taught in this class. New students get these automatically."
          >
            {allSubjects.length === 0 ? (
              <p className="text-sm text-slate-500">
                No subjects yet.{" "}
                <Link href="/admin/subjects" className="font-medium text-indigo-600 hover:underline">
                  Add subjects
                </Link>
              </p>
            ) : (
              <ActionForm
                syncKey={[...curriculumIds].sort().join()}
                action={setClassSubjects.bind(null, schoolClass.id)}
                className="space-y-4"
              >
                <div className="space-y-2">
                  {allSubjects.map((s) => (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm transition hover:border-indigo-200 hover:bg-indigo-50/30 has-[:checked]:border-indigo-300 has-[:checked]:bg-indigo-50/60"
                    >
                      <input
                        type="checkbox"
                        name="subjectIds"
                        value={s.id}
                        defaultChecked={curriculumIds.has(s.id)}
                        className={checkboxClass}
                      />
                      <span className="flex-1 font-medium text-slate-700">{s.name}</span>
                      <span className="font-mono text-[11px] text-slate-400">{s.code}</span>
                    </label>
                  ))}
                </div>
                <label className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                  <input type="checkbox" name="applyToStudents" defaultChecked className={`${checkboxClass} mt-0.5`} />
                  Also update subjects of students already in this class
                </label>
                <SubmitButton>Save curriculum</SubmitButton>
              </ActionForm>
            )}
          </Card>

          <Card title="Add section" icon={Plus} description="Add one or more, e.g. C or C, D.">
            <ActionForm action={addSection.bind(null, schoolClass.id)} className="space-y-3">
              <div className="flex gap-2">
                <input name="name" required placeholder="Section name" className={inputClass} />
                <SubmitButton icon={<Plus className="h-4 w-4" />}>Add</SubmitButton>
              </div>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}

function MiniStat({
  icon,
  tone,
  label,
  value,
}: {
  icon: typeof Users;
  tone: "sky" | "indigo" | "violet";
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <IconTile icon={icon} tone={tone} />
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-xl font-semibold tabular-nums text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function RollNumberBar({
  sectionId,
  label,
  total,
  missing,
}: {
  sectionId: string;
  label: string;
  total: number;
  missing: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-3">
      <span className="flex items-center gap-2 text-sm text-slate-600">
        <Hash className="h-4 w-4 text-slate-400" />
        Roll numbers:{" "}
        {missing ? (
          <Badge tone="amber" dot>
            {missing} without a number
          </Badge>
        ) : (
          <Badge tone="green" dot>
            all assigned
          </Badge>
        )}
      </span>
      <div className="flex flex-wrap items-center gap-1">
        {missing > 0 && missing < total && (
          <ActionForm
            action={assignRollNumbers.bind(null, sectionId, "missing")}
            compact
            className="flex flex-row-reverse items-center gap-2"
          >
            <SubmitButton variant="ghost" size="sm">
              Fill missing only
            </SubmitButton>
          </ActionForm>
        )}
        <ActionForm
          action={assignRollNumbers.bind(null, sectionId, "all")}
          compact
          className="flex flex-row-reverse items-center gap-2"
        >
          <SubmitButton
            variant="secondary"
            size="sm"
            confirm={`Number all ${total} students in ${label} from 1 in A–Z order? Existing roll numbers in this section will be replaced.`}
          >
            Auto-assign roll numbers
          </SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}
