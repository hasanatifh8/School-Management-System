import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, GraduationCap, Info, Rocket } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  PersonCell,
  Table,
  selectClass,
  tbodyClass,
  tdClass,
  thClass,
  theadClass,
  trClass,
} from "@/components/ui";
import { db } from "@/lib/db";
import { photoUrl } from "@/lib/photos";
import { fullName } from "@/lib/queries";
import { getCurrentSchool } from "@/lib/school";
import { getCurrentSession, getUpcomingSession, sessionName } from "@/lib/sessions";
import { promoteClass } from "../../../sessions/actions";

export default async function PromoteClassPage({ params }: PageProps<"/admin/classes/[id]/promote">) {
  const { id } = await params;
  const school = await getCurrentSchool();
  const [current, upcoming] = await Promise.all([getCurrentSession(school.id), getUpcomingSession(school.id)]);
  const nextName = upcoming?.name ?? sessionName(current.startDate.getUTCFullYear() + 1);

  const schoolClass = await db.schoolClass.findFirst({
    where: { id, schoolId: school.id },
    include: { sections: { orderBy: { name: "asc" } } },
  });
  if (!schoolClass) notFound();

  const [nextClass, students] = await Promise.all([
    db.schoolClass.findFirst({
      where: { schoolId: school.id, sortOrder: { gt: schoolClass.sortOrder } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { sections: { orderBy: { name: "asc" } } },
    }),
    db.student.findMany({
      where: { schoolId: school.id, status: "ACTIVE", section: { classId: id } },
      orderBy: [{ section: { name: "asc" } }, { rollNumber: { sort: "asc", nulls: "last" } }, { firstName: "asc" }],
      include: {
        section: true,
        enrollments: {
          where: { sessionId: { in: [current.id, ...(upcoming ? [upcoming.id] : [])] } },
          include: { section: true },
        },
      },
    }),
  ]);

  const nextSections = nextClass?.sections ?? [];

  /** Pre-selected choice: a saved decision, else next class with the same section letter. */
  function defaultDecision(s: (typeof students)[number]) {
    const now = s.enrollments.find((e) => e.sessionId === current.id);
    const later = upcoming && s.enrollments.find((e) => e.sessionId === upcoming.id);
    if (now?.result === "LEFT") return "left";
    if (now?.result === "PASSED_OUT") return "passed";
    if (later) return `${later.section.classId === id ? "repeat" : "promote"}:${later.sectionId}`;
    if (!nextSections.length) return "passed";
    const same = nextSections.find((n) => n.name === s.section?.name) ?? nextSections[0];
    return `promote:${same.id}`;
  }

  const decided = students.filter((s) => s.enrollments.some((e) => e.sessionId === current.id && e.result)).length;

  return (
    <>
      <PageHeader
        title={`Promote ${schoolClass.name}`}
        breadcrumbs={[
          { label: "Classes", href: "/admin/classes" },
          { label: schoolClass.name, href: `/admin/classes/${id}` },
          { label: "Promote" },
        ]}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="slate">{current.name}</Badge>
            <ArrowRight className="h-3.5 w-3.5" />
            <Badge tone="indigo">{nextName}</Badge>
            {!upcoming && <span>· session {nextName} will be created automatically</span>}
          </span>
        }
      />

      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm text-indigo-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
        <div>
          Every student is set to{" "}
          <strong>{nextClass ? `move up to ${nextClass.name}` : "pass out (this is the last class)"}</strong>. Change
          anyone who is repeating or leaving, then click <strong>Promote</strong>. Students stay in {schoolClass.name}{" "}
          until you start {nextName} from{" "}
          <Link href="/admin/sessions" className="font-medium underline">
            Sessions
          </Link>
          ; roll numbers are then assigned A–Z automatically.
        </div>
      </div>

      <Card padded={false}>
        {students.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No active students in this class"
            description="There is nobody to promote."
          />
        ) : (
          <ActionForm
            action={promoteClass.bind(null, id)}
            className="[&>[role=alert]]:mx-6 [&>[role=alert]]:mb-4 [&>[role=status]]:mx-6 [&>[role=status]]:mb-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{students.length}</span> students
                {decided > 0 && <> · {decided} already saved (you can change them)</>}
              </p>
              {nextClass && nextSections.length === 0 && (
                <Badge tone="amber" dot>
                  {nextClass.name} has no sections yet
                </Badge>
              )}
            </div>
            <Table>
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Roll</th>
                  <th className={thClass}>Student</th>
                  <th className={thClass}>Now</th>
                  <th className={thClass}>In {nextName}</th>
                </tr>
              </thead>
              <tbody className={tbodyClass}>
                {students.map((s) => (
                  <tr key={s.id} className={trClass}>
                    <td className={`${tdClass} w-16 tabular-nums text-slate-500`}>{s.rollNumber ?? "—"}</td>
                    <td className={tdClass}>
                      <PersonCell
                        name={fullName(s)}
                        photoUrl={photoUrl(s.photoId)}
                        sub={<span className="font-mono">{s.studentCode}</span>}
                      />
                    </td>
                    <td className={tdClass}>
                      <Badge tone="slate">
                        {schoolClass.name} – {s.section?.name}
                      </Badge>
                    </td>
                    <td className={`${tdClass} w-80`}>
                      <select
                        name={`decision:${s.id}`}
                        defaultValue={defaultDecision(s)}
                        aria-label={`Decision for ${fullName(s)}`}
                        className={`${selectClass} !py-2`}
                      >
                        {nextClass && nextSections.length > 0 && (
                          <optgroup label={`Promote to ${nextClass.name}`}>
                            {nextSections.map((n) => (
                              <option key={n.id} value={`promote:${n.id}`}>
                                ⬆ Promote → {nextClass.name} – {n.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label={`Repeat ${schoolClass.name}`}>
                          {schoolClass.sections.map((n) => (
                            <option key={n.id} value={`repeat:${n.id}`}>
                              ↺ Repeat → {schoolClass.name} – {n.name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Leaving">
                          <option value="passed">🎓 Passed out</option>
                          <option value="left">Left school (TC issued)</option>
                        </optgroup>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <Link href={`/admin/classes/${id}`} className="text-sm font-medium text-slate-600 hover:text-slate-900">
                Cancel
              </Link>
              <SubmitButton
                icon={<Rocket className="h-4 w-4" />}
                confirm={`Save promotion of ${students.length} student(s) from ${schoolClass.name} to ${nextName}?`}
              >
                Promote {students.length} students
              </SubmitButton>
            </div>
          </ActionForm>
        )}
      </Card>

      <p className="mt-4 text-sm text-slate-500">
        Next: promote the other classes, then start {nextName} from{" "}
        <Link href="/admin/sessions" className="font-medium text-indigo-600 hover:underline">
          Sessions
        </Link>
        .
      </p>
    </>
  );
}
