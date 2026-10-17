import Link from "next/link";
import { Banknote, CalendarRange, ChevronRight, FileText, Wallet } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, PagedList, StatCard, StatGrid } from "@/components/ui";
import { db } from "@/lib/db";
import { MODE_LABELS, rupees } from "@/lib/fees-shared";
import { loadComponents, loadOwnValues } from "@/lib/payroll";
import { computeSalary, dayCount } from "@/lib/payroll-shared";
import { getCurrentSession } from "@/lib/sessions";
import { requireTeacher } from "@/lib/teacher-auth";

const monthFormat = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** The teacher's salary: what it's made of, and every slip to view, print or download. */
export default async function TeacherSalaryPage() {
  const { teacher, school } = await requireTeacher();
  const [payments, components, own, session] = await Promise.all([
    db.salaryPayment.findMany({ where: { schoolId: school.id, teacherId: teacher.id }, orderBy: [{ month: "desc" }, { createdAt: "desc" }] }),
    loadComponents(school.id),
    loadOwnValues(school.id, { teacherId: teacher.id }),
    getCurrentSession(school.id),
  ]);
  const structure = teacher.monthlySalary ? computeSalary(teacher.monthlySalary, components, own.get(`T:${teacher.id}`) ?? {}) : null;
  const from = session.startDate.toISOString().slice(0, 7);
  const to = session.endDate.toISOString().slice(0, 7);
  const thisSession = payments.filter((p) => p.month >= from && p.month <= to);
  const last = payments[0];

  return (
    <>
      <PageHeader title="Salary slips" subtitle="Your monthly salary slips from the school. Open one to print it or save it as a PDF." />

      <div className="mb-6">
        <StatGrid cols={3}>
          <StatCard icon={Banknote} tone="emerald" label="Last salary" value={last ? rupees(last.amount) : "—"} detail={last ? monthFormat.format(new Date(`${last.month}-01T00:00:00Z`)) : "No salary paid yet"} />
          <StatCard icon={CalendarRange} tone="indigo" label={`Session ${session.name}`} value={rupees(thisSession.reduce((n, p) => n + p.amount, 0))} detail={`${thisSession.length} month${thisSession.length === 1 ? "" : "s"} paid`} />
          <StatCard icon={Wallet} tone="sky" label="Monthly net pay" value={structure ? rupees(structure.net) : "—"} detail={structure ? `Gross ${rupees(structure.gross)}` : "Not set by the school yet"} />
        </StatGrid>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card title="Slips" icon={FileText} padded={false}>
          {payments.length === 0 ? (
            <EmptyState icon={FileText} title="No salary slips yet" description="Your slip appears here once the school pays your salary for a month." />
          ) : (
            <PagedList pageSize={12} noun="slips">
              {payments.map((p) => (
                <li key={p.id}>
                  <Link href={`/teacher/salary/${p.id}`} className="group flex items-center gap-4 px-5 py-3.5 transition hover:bg-surface-2 sm:px-6">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-300">
                      <FileText className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-fg group-hover:text-accent-text">{monthFormat.format(new Date(`${p.month}-01T00:00:00Z`))}</span>
                      <span className="block text-xs text-muted">
                        Paid {dateFormat.format(p.paidOn)} · {MODE_LABELS[p.mode]}
                      </span>
                    </span>
                    {p.lopDays ? (
                      <Badge tone="red" dot>
                        {dayCount(p.lopDays)} unpaid
                      </Badge>
                    ) : null}
                    <span className="text-right">
                      <span className="block font-semibold tabular-nums text-fg">{rupees(p.amount)}</span>
                      {p.gross && p.gross !== p.amount ? <span className="block text-xs tabular-nums text-muted">of {rupees(p.gross)}</span> : null}
                    </span>
                    <ChevronRight className="h-4 w-4 text-subtle group-hover:text-accent-text" />
                  </Link>
                </li>
              ))}
            </PagedList>
          )}
        </Card>

        <Card title="Your salary" icon={Wallet} description="As set by the school. Ask your school admin about any change." padded={false}>
          {!structure ? (
            <p className="px-5 py-4 text-sm text-muted">Not set yet.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {structure.lines.map((l) => (
                <li key={l.name} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <span className="text-fg-2">{l.name}</span>
                  <span className={`tabular-nums ${l.kind === "DEDUCTION" ? "text-danger" : "text-fg"}`}>
                    {l.kind === "DEDUCTION" ? "−" : ""}
                    {rupees(l.amount)}
                  </span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-3 bg-surface-2 px-5 py-3 font-semibold">
                <span className="text-fg">Net a month</span>
                <span className="tabular-nums text-success">{rupees(structure.net)}</span>
              </li>
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
