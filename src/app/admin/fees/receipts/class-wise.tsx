import Link from "next/link";
import { ArrowLeft, CalendarDays, ChevronRight, Receipt, School, Users } from "lucide-react";
import { ReceiptActions } from "@/components/fees/receipt-actions";
import { Pagination } from "@/components/pagination";
import { Badge, ButtonLink, Card, EmptyState, IconTile, Table, tbodyClass, tdClass, thClass, theadClass, trClass } from "@/components/ui";
import { db } from "@/lib/db";
import { MODE_LABELS, rupees } from "@/lib/fees-shared";
import { paginate } from "@/lib/pagination";

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const base = "/admin/fees/receipts?view=class";

type Params = Record<string, string | string[] | undefined>;

/**
 * Class-wise receipts for the current session: classes, then a class's
 * sections, then the receipts of that section's students.
 */
export async function ClassWiseReceipts({ schoolId, sessionId, sessionName, sp }: { schoolId: string; sessionId: string; sessionName: string; sp: Params }) {
  const classId = typeof sp.class === "string" ? sp.class : "";
  const sectionId = typeof sp.section === "string" ? sp.section : "";

  if (sectionId) {
    const section = await db.section.findFirst({ where: { id: sectionId, class: { schoolId } }, include: { class: true } });
    if (section) return <SectionReceipts section={section} sessionId={sessionId} sessionName={sessionName} sp={sp} />;
  }

  // Receipt totals per section (students' current section), for the cards.
  const receipts = await db.feeReceipt.findMany({
    where: { schoolId, sessionId, cancelledAt: null, student: { sectionId: { not: null } } },
    select: { total: true, student: { select: { sectionId: true } } },
  });
  const bySection = new Map<string, { count: number; sum: number }>();
  for (const r of receipts) {
    const row = bySection.get(r.student!.sectionId!) ?? { count: 0, sum: 0 };
    row.count++;
    row.sum += r.total;
    bySection.set(r.student!.sectionId!, row);
  }

  const classes = await db.schoolClass.findMany({
    where: { schoolId, ...(classId ? { id: classId } : {}) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { sections: { orderBy: { name: "asc" }, include: { _count: { select: { students: { where: { status: "ACTIVE" } } } } } } },
  });
  const open = classId ? classes[0] : null;

  if (open) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <ButtonLink href={base} variant="secondary" size="lg" icon={ArrowLeft}>
            All classes
          </ButtonLink>
          <div>
            <p className="text-eyebrow uppercase text-muted">Receipts · {sessionName}</p>
            <h2 className="text-h2 font-semibold text-fg">{open.name}</h2>
          </div>
        </div>
        {open.sections.length === 0 ? (
          <Card>
            <EmptyState icon={School} title="No sections in this class" />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {open.sections.map((s) => {
              const t = bySection.get(s.id);
              return (
                <Link
                  key={s.id}
                  href={`${base}&section=${s.id}`}
                  className="group rounded-2xl border border-line bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:border-accent-line hover:shadow-lift"
                >
                  <span className="flex items-center justify-between">
                    <span className="text-xl font-semibold text-fg">Section {s.name}</span>
                    <ChevronRight className="h-5 w-5 text-subtle transition group-hover:translate-x-0.5 group-hover:text-accent-text" aria-hidden />
                  </span>
                  <span className="mt-2 flex items-center gap-1.5 text-sm text-muted">
                    <Users className="h-4 w-4" aria-hidden /> {s._count.students} students
                  </span>
                  <span className="mt-3 flex items-baseline justify-between border-t border-line pt-3 text-sm">
                    <span className="text-muted">{t?.count ?? 0} receipts</span>
                    <span className="font-semibold tabular-nums text-fg">{rupees(t?.sum ?? 0)}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (!classes.length) {
    return (
      <Card>
        <EmptyState icon={School} title="No classes yet" />
      </Card>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {classes.map((c) => {
        const count = c.sections.reduce((n, s) => n + (bySection.get(s.id)?.count ?? 0), 0);
        const sum = c.sections.reduce((n, s) => n + (bySection.get(s.id)?.sum ?? 0), 0);
        return (
          <Link
            key={c.id}
            href={`${base}&class=${c.id}`}
            className="group rounded-2xl border border-line bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:border-accent-line hover:shadow-lift"
          >
            <span className="flex items-center gap-3">
              <IconTile icon={School} tone="indigo" size="sm" />
              <span className="flex-1 font-semibold text-fg">{c.name}</span>
              <ChevronRight className="h-5 w-5 text-subtle transition group-hover:translate-x-0.5 group-hover:text-accent-text" aria-hidden />
            </span>
            <span className="mt-3 flex flex-wrap gap-1">
              {c.sections.map((s) => (
                <Badge key={s.id}>{s.name}</Badge>
              ))}
              {!c.sections.length && <span className="text-xs text-subtle">No sections</span>}
            </span>
            <span className="mt-3 flex items-baseline justify-between border-t border-line pt-3 text-sm">
              <span className="text-muted">{count} receipts</span>
              <span className="font-semibold tabular-nums text-fg">{rupees(sum)}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

async function SectionReceipts({
  section,
  sessionId,
  sessionName,
  sp,
}: {
  section: { id: string; name: string; classId: string; class: { name: string } };
  sessionId: string;
  sessionName: string;
  sp: Params;
}) {
  const where = { sessionId, student: { sectionId: section.id } };
  const [count, sum] = await Promise.all([
    db.feeReceipt.count({ where }),
    db.feeReceipt.aggregate({ where: { ...where, cancelledAt: null }, _sum: { total: true } }),
  ]);
  const paging = paginate(sp, count, 50);
  const receipts = await db.feeReceipt.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    skip: paging.skip,
    take: paging.take,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <ButtonLink href={`${base}&class=${section.classId}`} variant="secondary" size="lg" icon={ArrowLeft}>
          {section.class.name}
        </ButtonLink>
        <div>
          <p className="text-eyebrow uppercase text-muted">Receipts · {sessionName}</p>
          <h2 className="text-h2 font-semibold text-fg">
            {section.class.name} – {section.name}
          </h2>
        </div>
      </div>
      <Card padded={false} title={`${count} receipt${count === 1 ? "" : "s"} · ${rupees(sum._sum.total ?? 0)}`} description="Students currently in this section. Cancelled receipts are listed but not counted.">
        {receipts.length === 0 ? (
          <EmptyState icon={Receipt} title="No receipts yet" description="Fees collected from this section's students appear here." />
        ) : (
          <Table>
            <thead className={theadClass}>
              <tr>
                <th className={thClass}>Receipt</th>
                <th className={thClass}>Date</th>
                <th className={thClass}>Student</th>
                <th className={`${thClass} hidden md:table-cell`}>Mode</th>
                <th className={`${thClass} text-right`}>Amount</th>
                <th className={`${thClass} text-right`}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              {receipts.map((r) => (
                <tr key={r.id} className={`${trClass} ${r.cancelledAt ? "text-subtle" : ""}`}>
                  <td className={tdClass}>
                    <Link href={`/admin/fees/receipts/${r.id}?from=receipts`} className="font-mono text-xs font-medium text-accent-text hover:underline">
                      {r.number}
                    </Link>
                  </td>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-subtle" aria-hidden />
                      {dateFmt.format(r.date)}
                    </span>
                  </td>
                  <td className={tdClass}>
                    <p className="font-medium text-fg">{r.studentName}</p>
                    <p className="text-xs text-muted">{r.studentCode}</p>
                  </td>
                  <td className={`${tdClass} hidden md:table-cell`}>{MODE_LABELS[r.mode]}</td>
                  <td className={`${tdClass} text-right font-semibold tabular-nums`}>{r.cancelledAt ? <Badge tone="red">Cancelled</Badge> : rupees(r.total)}</td>
                  <td className={tdClass}>
                    <ReceiptActions id={r.id} number={r.number} />
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
