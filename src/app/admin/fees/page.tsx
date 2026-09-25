import Link from "next/link";
import { CalendarDays, IndianRupee, Receipt, TriangleAlert, Wallet } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, IconTile, Table, tbodyClass, tdClass, thClass, theadClass, trClass, type IconTone } from "@/components/ui";
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
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat icon={IndianRupee} tone="emerald" label="Collected today" value={rupees(todayAgg._sum.total ?? 0)} detail={`${todayAgg._count} receipt(s)`} />
        <Stat icon={CalendarDays} tone="indigo" label="This month" value={rupees(monthAgg._sum.total ?? 0)} detail={`${monthAgg._count} receipt(s)`} />
        <Stat icon={Receipt} tone="sky" label={`Session ${session.name}`} value={rupees(sessionAgg._sum.total ?? 0)} detail={`${sessionAgg._count} receipt(s)`} />
        <Stat icon={TriangleAlert} tone="rose" label="Due now" value={rupees(dueNow)} detail="Instalments due up to today" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Recent receipts" padded={false} className="xl:col-span-2" action={<Link href="/admin/fees/receipts" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">All receipts</Link>}>
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
                      <Link href={`/admin/fees/receipts/${r.id}`} className="font-mono text-xs font-medium text-indigo-600 hover:underline">
                        {r.number}
                      </Link>
                      <p className="text-xs text-slate-500">{shortDate.format(r.date)}</p>
                    </td>
                    <td className={tdClass}>
                      <p className="font-medium text-slate-900">{r.studentName}</p>
                      <p className="text-xs text-slate-500">{r.className ?? r.studentCode}</p>
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
              <p className="text-sm text-slate-500">Nothing collected yet today.</p>
            ) : (
              <dl className="space-y-2 text-sm">
                {todayByMode.map((m) => (
                  <div key={m.mode} className="flex justify-between">
                    <dt className="text-slate-600">{MODE_LABELS[m.mode]}</dt>
                    <dd className="font-medium tabular-nums text-slate-900">{rupees(m._sum.total ?? 0)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>
          <Card title="Due now by class" padded={false}>
            <ul className="divide-y divide-slate-100">
              {byClass.map(({ s, due, owing }) => (
                <li key={s.id}>
                  <Link href={`/admin/fees/collect?section=${s.id}`} className="flex items-center justify-between gap-3 px-6 py-2.5 text-sm hover:bg-slate-50">
                    <span>
                      <span className="font-medium text-slate-900">{sectionLabel(s)}</span>
                      <span className="block text-xs text-slate-500">{owing ? `${owing} of ${s.students.length} students owe` : "All clear"}</span>
                    </span>
                    <span className={`font-semibold tabular-nums ${due ? "text-rose-600" : "text-emerald-600"}`}>{due ? rupees(due) : "₹0"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, tone, label, value, detail }: { icon: typeof Wallet; tone: IconTone; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <IconTile icon={icon} tone={tone} />
      <p className="mt-3 text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}
