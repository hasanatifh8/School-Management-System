import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, CalendarCheck, CalendarClock, Crown, Hash, Layers, LayoutGrid, Plus, Rocket, Trash2, UserCog, Users } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { DialogButton } from "@/components/dialog-button";
import { SectionAttendance, SectionTimetable } from "./section-views";
import { Select } from "@/components/select";
import { TeacherOptions, type TeacherChoice } from "@/components/teaching/teacher-options";
import {
  Badge,
  ButtonLink,
  Card,
  checkboxClass,
  inputClass,
  PageHeader,
  selectClass,
  StatCard,
  tbodyClass,
  tdClass,
  thClass,
  theadClass,
} from "@/components/ui";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { sectionLabel } from "@/lib/queries";
import {
  addSection,
  assignClassTeacher,
  assignRollNumbers,
  assignSubjectTeacher,
  deleteClass,
  deleteSection,
  setClassSubjects,
} from "../actions";

export default async function ClassPage({ params, searchParams }: PageProps<"/admin/classes/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
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
      include: { classTeacherOf: { include: { class: true } }, canTeach: { select: { subjectId: true } } },
    }),
  ]);
  if (!schoolClass) notFound();

  const curriculum = schoolClass.subjects.map((cs) => cs.subject);
  const curriculumIds = new Set(curriculum.map((s) => s.id));
  const studentCount = schoolClass.sections.reduce((n, s) => n + s._count.students, 0);
  // The chosen section tab (?section=), or the first one.
  const section = schoolClass.sections.find((s) => s.id === sp.section) ?? schoolClass.sections[0];
  const base = `/admin/classes/${schoolClass.id}`;
  // What the section shows: its overview, timetable or attendance. Kept when switching sections.
  const view = VIEWS.find((v) => v.key === sp.view)?.key ?? "overview";
  const sectionHref = (sectionId: string, v: string = view) => `${base}?section=${sectionId}${v === "overview" ? "" : `&view=${v}`}`;

  return (
    <>
      <PageHeader
        title={schoolClass.name}
        breadcrumbs={[{ label: "Classes", href: "/admin/classes" }, { label: schoolClass.name }]}
        subtitle="Manage sections, curriculum and teacher assignments."
        action={
          <>
            <ButtonLink href="/admin/classes/assign" variant="secondary" icon={UserCog}>
              Assign teachers
            </ButtonLink>
            <ButtonLink href={`/admin/students?classId=${schoolClass.id}`} variant="secondary" icon={Users}>
              Students
            </ButtonLink>
            <ButtonLink href={`${base}/promote`} icon={Rocket}>
              Promote class
            </ButtonLink>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard icon={Layers} tone="sky" label="Sections" value={schoolClass.sections.length} />
        <StatCard icon={Users} tone="indigo" label="Students" value={studentCount} href={`/admin/students?classId=${schoolClass.id}`} />
        <StatCard icon={BookOpen} tone="violet" label="Subjects" value={curriculum.length} />
      </div>

      {/* Section tabs, with Add section and Curriculum beside them */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <nav aria-label="Sections" className="flex flex-wrap items-center gap-2">
          {schoolClass.sections.map((s) => {
            const active = s.id === section?.id;
            return (
              <Link
                key={s.id}
                href={sectionHref(s.id)}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 transition ${
                  active ? "border-accent bg-accent-soft shadow-card" : "border-line bg-surface hover:border-accent-line hover:bg-surface-2"
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold ${
                    active ? "bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-accent" : "bg-surface-3 text-fg-2"
                  }`}
                >
                  {s.name}
                </span>
                <span className="text-left leading-tight">
                  <span className={`block text-sm font-medium ${active ? "text-accent-text" : "text-fg"}`}>Section {s.name}</span>
                  <span className="block text-xs text-muted">{s._count.students} students</span>
                </span>
              </Link>
            );
          })}
          <DialogButton label="Add section" icon={<Plus className="h-4 w-4" />} variant="ghost" title="Add section" description={`Add one or more sections to ${schoolClass.name}, e.g. C or C, D.`}>
            <ActionForm action={addSection.bind(null, schoolClass.id)} className="flex gap-2">
              <input name="name" required autoFocus placeholder="Section name" className={inputClass} />
              <SubmitButton icon={<Plus className="h-4 w-4" />}>Add</SubmitButton>
            </ActionForm>
          </DialogButton>
        </nav>
        <span className="hidden h-8 w-px bg-line sm:block" aria-hidden />
        <DialogButton
          label={`Curriculum · ${curriculum.length} subject${curriculum.length === 1 ? "" : "s"}`}
          icon={<BookOpen className="h-4 w-4" />}
          title={`${schoolClass.name} curriculum`}
          description={`Subjects taught in every section of ${schoolClass.name}. New students get these automatically.`}
          drawer
        >
          {allSubjects.length === 0 ? (
            <p className="text-sm text-muted">
              No subjects yet.{" "}
              <Link href="/admin/subjects" className="font-medium text-accent-text hover:underline">
                Add subjects
              </Link>
            </p>
          ) : (
            <ActionForm syncKey={[...curriculumIds].sort().join()} action={setClassSubjects.bind(null, schoolClass.id)} className="space-y-4">
              <div className="space-y-2">
                {allSubjects.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-sm transition hover:border-accent-line hover:bg-accent-soft/30 has-[:checked]:border-accent-line has-[:checked]:bg-accent-soft/60"
                  >
                    <input type="checkbox" name="subjectIds" value={s.id} defaultChecked={curriculumIds.has(s.id)} className={checkboxClass} />
                    <span className="flex-1 font-medium text-fg-2">{s.name}</span>
                    <span className="font-mono text-[11px] text-subtle">{s.code}</span>
                  </label>
                ))}
              </div>
              <label className="flex items-start gap-2.5 rounded-lg bg-surface-2 p-3 text-sm text-fg-2">
                <input type="checkbox" name="applyToStudents" defaultChecked className={`${checkboxClass} mt-0.5`} />
                Also update subjects of students already in this class
              </label>
              <SubmitButton>Save for all sections</SubmitButton>
            </ActionForm>
          )}
        </DialogButton>
      </div>

      {!section ? (
        <Card>
          <p className="text-sm text-muted">This class has no sections yet. Use Add section to create one, then assign teachers and students.</p>
        </Card>
      ) : (
        <>
          <nav aria-label={`Section ${section.name}`} className="mb-4 flex flex-wrap gap-1 rounded-xl border border-line bg-surface-2 p-1 sm:inline-flex">
            {VIEWS.map((v) => {
              const active = v.key === view;
              return (
                <Link
                  key={v.key}
                  href={sectionHref(section.id, v.key)}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${active ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg"}`}
                >
                  <v.icon className="h-4 w-4" aria-hidden />
                  {v.label}
                  <span className="text-xs font-normal text-subtle">· {section.name}</span>
                </Link>
              );
            })}
          </nav>
          {view === "timetable" ? (
            <SectionTimetable schoolId={school.id} sectionId={section.id} />
          ) : view === "attendance" ? (
            <SectionAttendance schoolId={school.id} classId={schoolClass.id} sectionId={section.id} dateParam={sp.date} />
          ) : (
            <SectionPanel
              key={section.id}
              section={section}
              label={sectionLabel({ ...section, class: schoolClass })}
              classId={schoolClass.id}
              curriculum={curriculum}
              teachers={teachers}
            />
          )}
        </>
      )}

      <Card title="Delete class" description="Removes the class and all its sections. This only works when the class has no students." className="mt-6 border-danger-line">
        <ActionForm action={deleteClass.bind(null, schoolClass.id)} compact className="flex flex-row-reverse items-center justify-end gap-3">
          <SubmitButton variant="danger" confirm={`Delete ${schoolClass.name} and all its sections?`} icon={<Trash2 className="h-4 w-4" />}>
            Delete class
          </SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}

const VIEWS = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "timetable", label: "Timetable", icon: CalendarClock },
  { key: "attendance", label: "Attendance", icon: CalendarCheck },
] as const;

type Teacher = TeacherChoice;

/** One section: roll numbers, class teacher and its subject teachers. */
function SectionPanel({
  section,
  label,
  classId,
  curriculum,
  teachers,
}: {
  section: {
    id: string;
    name: string;
    classTeacherId: string | null;
    subjectAssignments: { subjectId: string; teacherId: string }[];
    students: { rollNumber: number | null }[];
    _count: { students: number };
  };
  label: string;
  classId: string;
  curriculum: { id: string; name: string; code: string }[];
  teachers: Teacher[];
}) {
  const assignedBySubject = new Map(section.subjectAssignments.map((a) => [a.subjectId, a.teacherId]));
  const unassigned = curriculum.filter((s) => !assignedBySubject.has(s.id)).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-base font-semibold text-white shadow-accent">
            {section.name}
          </span>
          <div>
            <h2 className="font-semibold text-fg">{label}</h2>
            <Link href={`/admin/students?classId=${classId}&sectionId=${section.id}`} className="text-xs text-muted hover:text-accent-text">
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

      {section._count.students > 0 && (
        <RollNumberBar sectionId={section.id} label={label} total={section._count.students} missing={section.students.filter((s) => s.rollNumber == null).length} />
      )}

      {/* Class teacher */}
      <div className="border-b border-line bg-gradient-to-r from-accent-soft to-transparent px-6 py-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-fg-2">
          <Crown className="h-4 w-4 text-accent-text" />
          Class teacher
        </div>
        <ActionForm syncKey={section.classTeacherId ?? ""} action={assignClassTeacher.bind(null, section.id)} compact className="flex flex-wrap items-center gap-2">
          <Select name="teacherId" defaultValue={section.classTeacherId ?? ""} className={`${selectClass} max-w-sm !py-2`}>
            <TeacherOptions teachers={teachers} forSection={section.id} empty="— No class teacher —" />
          </Select>
          <SubmitButton variant="secondary" size="sm">
            Save
          </SubmitButton>
        </ActionForm>
      </div>

      {/* Subject teachers: each subject offers only the teachers who teach it */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-6 pb-2 pt-4">
        <div>
          <h3 className="text-sm font-medium text-fg-2">Subject teachers</h3>
          <p className="text-xs text-muted">Teachers who teach a subject are listed first; choosing anyone else adds the subject to their profile.</p>
        </div>
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
        <p className="px-6 pb-5 text-sm text-muted">Add subjects with the Curriculum button above first.</p>
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
                      <div className="font-medium text-fg">{subject.name}</div>
                      <div className="font-mono text-[11px] text-subtle">{subject.code}</div>
                    </td>
                    <td className={tdClass}>
                        <ActionForm syncKey={current} action={assignSubjectTeacher.bind(null, section.id, subject.id)} compact className="flex flex-wrap items-center gap-2">
                          <Select
                            name="teacherId"
                            defaultValue={current}
                            className={`${selectClass} max-w-xs !py-2 ${current ? "" : "!border-warning-line !bg-warning-soft/40"}`}
                          >
                            <TeacherOptions teachers={teachers} subject={subject} empty="— Not assigned —" />
                          </Select>
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-3">
      <span className="flex items-center gap-2 text-sm text-fg-2">
        <Hash className="h-4 w-4 text-subtle" />
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
