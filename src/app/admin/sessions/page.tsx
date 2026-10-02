import Link from "next/link";
import { CalendarCog, CalendarRange, CircleCheck, CircleDashed, History, PartyPopper, Rocket } from "lucide-react";
import type { EnrollmentResult } from "@/generated/prisma/enums";
import { ActionForm, SubmitButton } from "@/components/forms";
import {
  Badge,
  Card,
  PageHeader,
  Table,
  buttonVariants,
  tbodyClass,
  tdClass,
  thClass,
  theadClass,
  trClass,
} from "@/components/ui";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { getCurrentSession, getUpcomingSession, sessionName } from "@/lib/sessions";
import { beginPromotion, startNextSession } from "./actions";
import { SessionDatesForm } from "./session-dates-form";

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

type ClassRow = {
  id: string;
  name: string;
  sortOrder: number;
  total: number;
  counts: Record<EnrollmentResult, number>;
};

export default async function SessionsPage({ searchParams }: PageProps<"/admin/sessions">) {
  const started = (await searchParams).started === "1";
  const school = await getCurrentSchool();
  const [current, upcoming] = await Promise.all([getCurrentSession(school.id), getUpcomingSession(school.id)]);
  const nextName = upcoming?.name ?? sessionName(current.startDate.getUTCFullYear() + 1);

  const [students, classes, closed] = await Promise.all([
    db.student.findMany({
      where: { schoolId: school.id, status: "ACTIVE", sectionId: { not: null } },
      select: {
        section: { select: { classId: true } },
        enrollments: { where: { sessionId: current.id }, select: { result: true } },
      },
    }),
    db.schoolClass.findMany({
      where: { schoolId: school.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, sortOrder: true },
    }),
    db.academicSession.findMany({
      where: { schoolId: school.id, status: "CLOSED" },
      orderBy: { startDate: "desc" },
      include: { _count: { select: { enrollments: true } } },
    }),
  ]);

  // Per-class progress for this year's promotion.
  const rows = new Map<string, ClassRow>(
    classes.map((c) => [c.id, { ...c, total: 0, counts: { PROMOTED: 0, DETAINED: 0, LEFT: 0, PASSED_OUT: 0 } }]),
  );
  for (const s of students) {
    const row = rows.get(s.section!.classId)!;
    row.total++;
    const result = s.enrollments[0]?.result;
    if (result) row.counts[result]++;
  }
  const classRows = [...rows.values()].filter((r) => r.total > 0);
  const decidedOf = (r: ClassRow) => r.counts.PROMOTED + r.counts.DETAINED + r.counts.LEFT + r.counts.PASSED_OUT;
  const doneClasses = classRows.filter((r) => decidedOf(r) === r.total).length;
  const pendingClasses = classRows.filter((r) => decidedOf(r) < r.total);

  return (
    <>
      <PageHeader title="Sessions" subtitle="Academic years run April–March unless you change the dates. Promote classes at the end of each year." />

      {started && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-success-line bg-success-soft p-4 text-sm text-success">
          <PartyPopper className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Session {current.name} has started.</p>
            <p>Students are in their new classes and roll numbers were assigned A–Z. You can adjust them on each class page.</p>
          </div>
        </div>
      )}

      {/* Current session */}
      <section className="mb-6 flex flex-wrap items-center gap-5 rounded-2xl bg-gradient-to-br from-[#5b4ee8] via-[#5a45e0] to-violet-700 p-6 text-white shadow-accent sm:p-8">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
          <CalendarRange className="h-7 w-7" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium text-white/80">Current session</p>
          <p className="text-display-sm font-semibold">{current.name}</p>
          <p className="text-sm text-white/80">
            {dateFormat.format(current.startDate)} – {dateFormat.format(current.endDate)}
            <a href="#session-dates" className="ml-2 font-medium text-white underline-offset-4 hover:underline">
              Change dates
            </a>
          </p>
        </div>
        <div className="rounded-xl bg-white/15 px-4 py-2 text-right">
          <p className="text-2xl font-semibold tabular-nums">{students.length}</p>
          <p className="text-xs text-white/80">students in classes</p>
        </div>
      </section>

      <Card
        id="session-dates"
        title="Session dates"
        icon={CalendarCog}
        description="When the school year starts and ends. Attendance, exams and ID card validity follow these dates."
        className="mb-6 scroll-mt-24"
      >
        <div className="grid gap-6 lg:grid-cols-2">
          {[current, ...(upcoming ? [upcoming] : [])].map((s) => (
            <SessionDatesForm
              key={s.id}
              session={{ id: s.id, name: s.name, status: s.status, startDate: isoDate(s.startDate), endDate: isoDate(s.endDate) }}
            />
          ))}
        </div>
        <p className="mt-4 text-xs text-muted">
          Existing attendance, fee receipts and exam papers must stay inside the session. Once fees are collected, the start month is
          fixed because monthly and quarterly instalments count from it.
          {!upcoming && " The next session will start the day after this one ends."}
        </p>
      </Card>

      {!upcoming ? (
        <Card title={`Year-end promotion to ${nextName}`} icon={Rocket}>
          <ol className="grid gap-4 text-sm md:grid-cols-3">
            {[
              ["Promote each class", "Open a class and click “Promote class”. Everyone moves up by default; mark anyone repeating or leaving."],
              ["Check progress here", "This page shows which classes are done."],
              [`Start ${nextName}`, "One click moves every student to their new class and numbers them A–Z."],
            ].map(([title, text], i) => (
              <li key={title} className="flex gap-3 rounded-xl bg-surface-2 p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
                  {i + 1}
                </span>
                <span>
                  <span className="block font-medium text-fg">{title}</span>
                  <span className="text-muted">{text}</span>
                </span>
              </li>
            ))}
          </ol>
          <ActionForm action={beginPromotion} className="mt-5 flex flex-wrap items-center gap-3">
            <SubmitButton icon={<Rocket className="h-4 w-4" />}>Begin promotion to {nextName}</SubmitButton>
            <span className="text-sm text-muted">
              or click <strong>Promote class</strong> on any{" "}
              <Link href="/admin/classes" className="font-medium text-accent-text hover:underline">
                class
              </Link>
              .
            </span>
          </ActionForm>
        </Card>
      ) : (
        <Card
          title={`Promotion to ${upcoming.name}`}
          icon={Rocket}
          description={`${doneClasses} of ${classRows.length} classes done`}
          padded={false}
          action={
            <div className="hidden h-2 w-40 overflow-hidden rounded-full bg-surface-3 sm:block">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                style={{ width: `${classRows.length ? (doneClasses / classRows.length) * 100 : 100}%` }}
              />
            </div>
          }
        >
          {classRows.length === 0 ? (
            <p className="p-6 text-sm text-muted">No students are in classes, so there is nothing to promote.</p>
          ) : (
            <Table>
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Class</th>
                  <th className={thClass}>Students</th>
                  <th className={thClass}>Decisions</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody className={tbodyClass}>
                {classRows.map((r) => {
                  const decided = decidedOf(r);
                  const done = decided === r.total;
                  return (
                    <tr key={r.id} className={trClass}>
                      <td className={`${tdClass} font-medium text-fg`}>{r.name}</td>
                      <td className={`${tdClass} tabular-nums`}>{r.total}</td>
                      <td className={tdClass}>
                        <div className="flex flex-wrap gap-1">
                          {r.counts.PROMOTED > 0 && <Badge tone="indigo">{r.counts.PROMOTED} promoted</Badge>}
                          {r.counts.DETAINED > 0 && <Badge tone="amber">{r.counts.DETAINED} repeating</Badge>}
                          {r.counts.PASSED_OUT > 0 && <Badge tone="green">{r.counts.PASSED_OUT} passed out</Badge>}
                          {r.counts.LEFT > 0 && <Badge tone="slate">{r.counts.LEFT} left</Badge>}
                          {!decided && <span className="text-subtle">—</span>}
                        </div>
                      </td>
                      <td className={tdClass}>
                        {done ? (
                          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                            <CircleCheck className="h-4 w-4" /> Done
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-sm text-warning">
                            <CircleDashed className="h-4 w-4" /> {r.total - decided} pending
                          </span>
                        )}
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <Link
                          href={`/admin/classes/${r.id}/promote`}
                          className={done ? buttonVariants.ghost : `${buttonVariants.primary} !px-3 !py-1.5`}
                        >
                          {done ? "Review" : "Promote"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line bg-surface-2/60 px-6 py-5">
            <div className="text-sm">
              {pendingClasses.length ? (
                <p className="text-fg-2">
                  Promote{" "}
                  <strong>{pendingClasses.map((c) => c.name).join(", ")}</strong> to start {upcoming.name}.
                </p>
              ) : (
                <p className="text-fg-2">
                  All classes are ready. Starting <strong>{upcoming.name}</strong> moves every student to their new class,
                  marks leavers as removed and assigns roll numbers A–Z.
                </p>
              )}
            </div>
            <ActionForm
              action={startNextSession.bind(null, upcoming.id)}
              compact
              className="flex flex-row-reverse flex-wrap items-center gap-3"
            >
              <SubmitButton
                icon={<Rocket className="h-4 w-4" />}
                confirm={`Start ${upcoming.name}? Every student moves to their new class and ${current.name} is closed. This can't be undone.`}
              >
                Start {upcoming.name}
              </SubmitButton>
            </ActionForm>
          </div>
        </Card>
      )}

      {closed.length > 0 && (
        <Card title="Past sessions" icon={History} className="mt-6" padded={false}>
          <ul className="divide-y divide-line">
            {closed.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 text-sm">
                <span className="font-semibold text-fg">{s.name}</span>
                <span className="text-muted">
                  {dateFormat.format(s.startDate)} – {dateFormat.format(s.endDate)}
                </span>
                <Badge>{s._count.enrollments} students</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
