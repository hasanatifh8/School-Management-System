import Link from "next/link";
import { Receipt } from "lucide-react";
import { Pagination } from "@/components/pagination";
import { Badge, Card, EmptyState, Table, buttonVariants, inputClass, selectClass, tbodyClass, tdClass, thClass, theadClass, trClass } from "@/components/ui";
import { parseISODate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { getFeesAccess } from "@/lib/fees";
import { MODE_LABELS, PAYMENT_MODES, rupees, type PaymentModeKey } from "@/lib/fees-shared";
import { paginate } from "@/lib/pagination";
import type { Prisma } from "@/generated/prisma/client";

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Receipts between two dates, searchable, with totals by payment mode. */
export default async function ReceiptsPage({ searchParams }: PageProps<"/admin/fees/receipts">) {
  const sp = await searchParams;
  const { school, today } = await getFeesAccess();
  const from = typeof sp.from === "string" && parseISODate(sp.from) ? sp.from : `${today.slice(0, 7)}-01`;
  const to = typeof sp.to === "string" && parseISODate(sp.to) ? sp.to : today;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const mode = PAYMENT_MODES.find((m) => m === sp.mode) as PaymentModeKey | undefined;

  const where: Prisma.FeeReceiptWhereInput = {
    schoolId: school.id,
    date: { gte: parseISODate(from)!, lte: parseISODate(to)! },
    ...(mode && { mode }),
    ...(q && {
      OR: [
        { number: { contains: q, mode: "insensitive" } },
        { studentName: { contains: q, mode: "insensitive" } },
        { studentCode: { contains: q, mode: "insensitive" } },
        { reference: { contains: q, mode: "insensitive" } },
      ],
    }),
  };
  // Totals cover every matching receipt, not just the page shown.
  const [count, modeTotals] = await Promise.all([
    db.feeReceipt.count({ where }),
    db.feeReceipt.groupBy({ by: ["mode"], where: { ...where, cancelledAt: null }, _sum: { total: true }, _count: true }),
  ]);
  const paging = paginate(sp, count, 50);
  const receipts = await db.feeReceipt.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    skip: paging.skip,
    take: paging.take,
  });
  const validCount = modeTotals.reduce((n, x) => n + x._count, 0);
  const total = modeTotals.reduce((n, x) => n + (x._sum.total ?? 0), 0);
  const byMode = PAYMENT_MODES.map((m) => ({ m, sum: modeTotals.find((x) => x.mode === m)?._sum.total ?? 0 })).filter((x) => x.sum);

  return (
    <div className="space-y-6">
      <Card>
        <form className="flex flex-wrap items-end gap-3" action="/admin/fees/receipts">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">From</span>
            <input type="date" name="from" defaultValue={from} max={today} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">To</span>
            <input type="date" name="to" defaultValue={to} max={today} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Mode</span>
            <select name="mode" defaultValue={mode ?? ""} className={`${selectClass} !w-40`}>
              <option value="">All</option>
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {MODE_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-52 flex-1">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Search</span>
            <input name="q" defaultValue={q} placeholder="Receipt no., student, ID or reference" className={inputClass} />
          </label>
          <button type="submit" className={buttonVariants.primary}>
            Show
          </button>
        </form>
      </Card>

      <Card
        padded={false}
        title={`${validCount} receipt${validCount === 1 ? "" : "s"} · ${rupees(total)}`}
        description={byMode.map((x) => `${MODE_LABELS[x.m]} ${rupees(x.sum)}`).join(" · ") || undefined}
      >
        {receipts.length === 0 ? (
          <EmptyState icon={Receipt} title="No receipts in this period" />
        ) : (
          <Table>
            <thead className={theadClass}>
              <tr>
                <th className={thClass}>Receipt</th>
                <th className={thClass}>Date</th>
                <th className={thClass}>Student</th>
                <th className={thClass}>Mode</th>
                <th className={thClass}>Collected by</th>
                <th className={`${thClass} text-right`}>Amount</th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              {receipts.map((r) => (
                <tr key={r.id} className={`${trClass} ${r.cancelledAt ? "text-slate-400" : ""}`}>
                  <td className={tdClass}>
                    <Link href={`/admin/fees/receipts/${r.id}`} className="font-mono text-xs font-medium text-indigo-600 hover:underline">
                      {r.number}
                    </Link>
                  </td>
                  <td className={`${tdClass} whitespace-nowrap`}>{dateFmt.format(r.date)}</td>
                  <td className={tdClass}>
                    <p className="font-medium text-slate-900">{r.studentName}</p>
                    <p className="text-xs text-slate-500">
                      {r.studentCode}
                      {r.className && ` · ${r.className}`}
                    </p>
                  </td>
                  <td className={tdClass}>
                    {MODE_LABELS[r.mode]}
                    {r.reference && <p className="text-xs text-slate-500">{r.reference}</p>}
                  </td>
                  <td className={tdClass}>{r.collectedBy}</td>
                  <td className={`${tdClass} text-right font-semibold tabular-nums`}>
                    {r.cancelledAt ? <Badge tone="red">Cancelled</Badge> : rupees(r.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination paging={paging} noun="receipts" />
      </Card>
    </div>
  );
}
