import Link from "next/link";
import { CalendarDays, IndianRupee, Receipt, TriangleAlert, Wallet } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, PagedList, ProgressBar, StatCard, StatGrid, Table, tbodyClass, tdClass, TextLink, thClass, theadClass, trClass } from "@/components/ui";
import { parseISODate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { getFeesAccess, outstandingByStudent } from "@/lib/fees";
import { MODE_LABELS, rupees } from "@/lib/fees-shared";
import { sectionLabel } from "@/lib/queries";

const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** Collections at a glance: today, this month, this session, and what is due by class. */
export default async function FeesOverviewPage() {
  const { school, session, today, canManage } = await getFeesAccess();
  const headCount = await db.feeHead.count({ where: { sessionId: session.id } });
  if (!headCount) {
    return (
      <Card>
        <EmptyState
          icon={Wallet}
          title="Set up the fee structure first"
          description={canManage ? "Add the fees your school charges and their amounts for each class. Then you can start collecting." : "Ask the school admin to set up the fee structure."}
          action={canManage && <ButtonLink href="/admin/fees/structure">Set up fees</ButtonLink>}
        />
      </Card>
    );
  }

  const valid = { schoolId: school.id, cancelledAt: null };
  const monthStart = parseISODate(`${today.slice(0, 7)}-01`)!;
  const [todayAgg, monthAgg, sessionAgg, todayByMode, recent, sections, outstanding] = await Promise.all([
    db.feeReceipt.aggregate({ where: { ...valid, date: parseISODate(today)! }, _sum: { total: true }, _count: true }),
    db.feeReceipt.aggregate({ where: { ...valid, date: { gte: monthStart } }, _sum: { total: true }, _count: true }),
    db.feeReceipt.aggregate({ where: { ...valid, sessionId: session.id }, _sum: { total: true }, _count: true }),
    db.feeReceipt.groupBy({ by: ["mode"], where: { ...valid, date: parseISODate(today)! }, _sum: { total: true } }),
    db.feeReceipt.findMany({ where: { schoolId: school.id }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.section.findMany({ where: { class: { schoolId: school.id } }, orderBy: [{ class: { sortOrder: "asc" } }, { name: "asc" }], include: { class: true, students: { where: { status: "ACTIVE" }, select: { id: true } } } }),
    outstandingByStudent(school.id),
  ]);
  const dueNow = [...outstanding.values()].reduce((n, d) => n + d.dueNow, 0);
  const byClass = sections
    .map((s) => ({ s, due: s.students.reduce((n, st) => n + (outstanding.get(st.id)?.dueNow ?? 0), 0), owing: s.students.filter((st) => outstanding.get(st.id)?.dueNow).length }))
    .filter((c) => c.s.students.length);

  return (
    <div className="space-y-6">
      <StatGrid>
        <StatCard icon={IndianRupee} tone="emerald" label="Collected today" value={todayAgg._sum.total ?? 0} prefix="₹" detail={`${todayAgg._count} receipt(s)`} href="/admin/fees/receipts" />
        <StatCard icon={CalendarDays} tone="indigo" label="This month" value={monthAgg._sum.total ?? 0} prefix="₹" detail={`${monthAgg._count} receipt(s)`} />
        <StatCard icon={Receipt} tone="sky" label={`Session ${session.name}`} value={sessionAgg._sum.total ?? 0} prefix="₹" detail={`${sessionAgg._count} receipt(s)`} />
        <StatCard icon={TriangleAlert} tone="rose" label="Due now" value={dueNow} prefix="₹" detail="Instalments due up to today" href="/admin/fees/collect" />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Recent receipts" padded={false} className="xl:col-span-2" action={<TextLink href="/admin/fees/receipts">All receipts</TextLink>}>
          {recent.length === 0 ? (
            <EmptyState icon={Receipt} title="No payments yet" description="Payments you collect appear here." action={<ButtonLink href="/admin/fees/collect">Collect fees</ButtonLink>} />
          ) : (
            <Table>
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Receipt</th>
                  <th className={thClass}>Student</th>
                  <th className={thClass}>Mode</th>
                  <th className={`${thClass} text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody className={tbodyClass}>
                {recent.map((r) => (
                  <tr key={r.id} className={trClass}>
                    <td className={tdClass}>
                      <Link href={`/admin/fees/receipts/${r.id}`} className="font-mono text-xs font-medium text-accent-text hover:underline">
                        {r.number}
                      </Link>
                      <p className="text-xs text-muted">{shortDate.format(r.date)}</p>
                    </td>
                    <td className={tdClass}>
                      <p className="font-medium text-fg">{r.studentName}</p>
                      <p className="text-xs text-muted">{r.className ?? r.studentCode}</p>
                    </td>
                    <td className={tdClass}>{MODE_LABELS[r.mode]}</td>
                    <td className={`${tdClass} text-right font-medium tabular-nums`}>
                      {r.cancelledAt ? <Badge tone="red">Cancelled</Badge> : rupees(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="space-y-6 self-start">
          <Card title="Today by payment mode">
            {todayByMode.length === 0 ? (
              <p className="text-sm text-muted">Nothing collected yet today.</p>
            ) : (
              <dl className="space-y-3 text-sm">
                {todayByMode.map((m) => (
                  <div key={m.mode}>
                    <div className="flex justify-between">
                      <dt className="text-fg-2">{MODE_LABELS[m.mode]}</dt>
                      <dd className="font-medium tabular-nums text-fg">{rupees(m._sum.total ?? 0)}</dd>
                    </div>
                    <ProgressBar value={((m._sum.total ?? 0) / Math.max(1, todayAgg._sum.total ?? 0)) * 100} tone="success" className="mt-1.5 !h-1.5" label={`${MODE_LABELS[m.mode]} share`} />
                  </div>
                ))}
              </dl>
            )}
          </Card>
          <Card title="Due now by class" padded={false}>
            <PagedList pageSize={8} noun="classes">
              {byClass.map(({ s, due, owing }) => (
                <li key={s.id}>
                  <Link href={`/admin/fees/collect?section=${s.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition hover:bg-surface-2 sm:px-6">
                    <span>
                      <span className="font-medium text-fg">{sectionLabel(s)}</span>
                      <span className="block text-xs text-muted">{owing ? `${owing} of ${s.students.length} students owe` : "All clear"}</span>
                    </span>
                    <span className={`font-semibold tabular-nums ${due ? "text-danger" : "text-success"}`}>{due ? rupees(due) : "₹0"}</span>
                  </Link>
                </li>
              ))}
            </PagedList>
          </Card>
        </div>
      </div>
    </div>
  );
}
