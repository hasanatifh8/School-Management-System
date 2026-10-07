import Link from "next/link";
import { ArrowLeft, Check, CircleCheck, HandCoins, IndianRupee, LayoutList, Phone, Receipt, SearchCheck, Wallet } from "lucide-react";
import { Avatar, Badge, ButtonLink, Card, EmptyState } from "@/components/ui";
import { parseISODate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { getFeesAccess, loadStudentAccount, outstandingByStudent } from "@/lib/fees";
import { MODE_LABELS, deskMonths, rupees, type DeskMonthStatus } from "@/lib/fees-shared";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";
import type { DeskStudent } from "./actions";
import { DeskSearch } from "./desk-search";

const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * The Fee desk: a cashier's one-screen counter. Find a student on the left;
 * on the right, their twelve months show what is paid and what is due. A month
 * opens as a fee bill to collect, which then prints as the receipt. The classic
 * Fees pages stay available for anything unusual.
 */
export default async function FeeDeskPage({ searchParams }: PageProps<"/admin/fee-desk">) {
  const sp = await searchParams;
  const { school, session, today, canManage } = await getFeesAccess();
  const selectedId = typeof sp.s === "string" ? sp.s : null;

  if (!(await db.feeHead.count({ where: { sessionId: session.id } }))) {
    return (
      <>
        <DeskHeader />
        <Card>
          <EmptyState
            icon={Wallet}
            title="Set up the fee structure first"
            description={canManage ? "Add the fees your school charges for each class, then collect them here." : "Ask the school admin to set up the fee structure."}
            action={canManage && <ButtonLink href="/admin/fees/structure">Set up fees</ButtonLink>}
          />
        </Card>
      </>
    );
  }

  const valid = { schoolId: school.id, cancelledAt: null, date: parseISODate(today)! };
  const [todayAgg, byMode, sections, lastReceipts, account] = await Promise.all([
    db.feeReceipt.aggregate({ where: valid, _sum: { total: true }, _count: true }),
    db.feeReceipt.groupBy({ by: ["mode"], where: valid, _sum: { total: true } }),
    db.section.findMany({ where: { class: { schoolId: school.id } }, orderBy: [{ class: { sortOrder: "asc" } }, { name: "asc" }], include: { class: true } }),
    db.feeReceipt.findMany({ where: { schoolId: school.id, studentId: { not: null } }, orderBy: { createdAt: "desc" }, take: 40, select: { studentId: true } }),
    selectedId ? loadStudentAccount(school.id, selectedId) : null,
  ]);

  // Recent: the last few students paid for, newest first.
  const recentIds = [...new Set(lastReceipts.map((r) => r.studentId!))].slice(0, 8);
  const [recentStudents, recentDues] = recentIds.length
    ? await Promise.all([
        db.student.findMany({ where: { id: { in: recentIds }, status: "ACTIVE" }, include: { section: { include: { class: true } } } }),
        outstandingByStudent(school.id, { id: { in: recentIds } }),
      ])
    : [[], new Map()];
  const recent: DeskStudent[] = recentIds
    .map((id) => recentStudents.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => !!s)
    .map((s) => ({
      id: s.id,
      name: fullName(s),
      code: s.studentCode,
      roll: s.rollNumber,
      className: s.section ? sectionLabel(s.section) : null,
      father: s.fatherName,
      phone: s.phone,
      photoUrl: photoUrl(s.photoId),
      dueNow: recentDues.get(s.id)?.dueNow ?? 0,
    }));

  return (
    <>
      <DeskHeader />

      {/* Today at this counter */}
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-line bg-surface px-4 py-3 shadow-card sm:px-5">
        <span className="flex items-baseline gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">Collected today</span>
          <span className="text-xl font-semibold tabular-nums text-success">{rupees(todayAgg._sum.total ?? 0)}</span>
          <span className="text-xs text-muted">
            {todayAgg._count} receipt{todayAgg._count === 1 ? "" : "s"}
          </span>
        </span>
        <span className="flex flex-wrap gap-1.5">
          {byMode.map((m) => (
            <Badge key={m.mode}>
              {MODE_LABELS[m.mode]} {rupees(m._sum.total ?? 0)}
            </Badge>
          ))}
        </span>
        <Link href="/admin/fees/receipts" className="ml-auto text-sm font-medium text-accent-text hover:underline">
          All receipts
        </Link>
      </div>

      <div className="grid gap-4 lg:h-[calc(100dvh-15rem)] lg:min-h-[34rem] lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className={account ? "hidden lg:block lg:min-h-0" : "lg:min-h-0"}>
          <DeskSearch selectedId={selectedId} sections={sections.map((s) => ({ id: s.id, label: sectionLabel(s) }))} recent={recent} />
        </div>

        <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          {!selectedId ? (
            <Card className="lg:h-full">
              <EmptyState
                icon={SearchCheck}
                title="Find a student to collect fees"
                description="Search by name, student ID, father's name, phone or roll number, or browse a class. Their dues open here, ready to collect."
              />
            </Card>
          ) : !account ? (
            <Card>
              <EmptyState icon={SearchCheck} title="Student not found" action={<ButtonLink href="/admin/fee-desk">Find another</ButtonLink>} />
            </Card>
          ) : (
            <StudentPanel account={account} today={today} />
          )}
        </div>
      </div>
    </>
  );
}

function DeskHeader() {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-fg">
          <HandCoins className="h-6 w-6 text-accent-text" />
          Fee desk
          <Badge tone="indigo">New</Badge>
        </h1>
        <p className="text-sm text-muted">Find a student, open a month, collect and print the receipt.</p>
      </div>
      <ButtonLink href="/admin/fees" variant="ghost" icon={LayoutList}>
        Classic fees
      </ButtonLink>
    </div>
  );
}

/** The chosen student: who they are, their twelve months at a glance, and recent receipts. */
function StudentPanel({ account, today }: { account: NonNullable<Awaited<ReturnType<typeof loadStudentAccount>>>; today: string }) {
  const { student, dues, totals, receipts, session } = account;
  const name = fullName(student);
  const months = deskMonths(dues, session.startDate.toISOString().slice(0, 10), today);
  // The oldest month still owing (due by now), collected first.
  const payNow = months.find((m) => m.status === "OVERDUE" || m.status === "DUE" || (m.status === "PARTIAL" && (m.key === "arrears" || m.key <= today.slice(0, 7))));
  const unpaidCount = months.filter((m) => m.status === "OVERDUE" || m.status === "DUE" || m.status === "PARTIAL").length;
  const href = (month: string) => `/admin/fee-desk/${student.id}/${month}`;

  return (
    <>
      <section className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
        <Link href="/admin/fee-desk" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-accent-text lg:hidden">
          <ArrowLeft className="h-3.5 w-3.5" /> Find another student
        </Link>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={name} src={photoUrl(student.photoId)} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-fg">{name}</h2>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              {student.section && <Badge tone="indigo">{sectionLabel(student.section)}</Badge>}
              <span className="font-mono">{student.studentCode}</span>
              {student.fatherName && <span>· {student.fatherName}</span>}
              {student.phone && (
                <a href={`tel:${student.phone}`} className="inline-flex items-center gap-1 text-accent-text hover:underline">
                  <Phone className="h-3.5 w-3.5" /> {student.phone}
                </a>
              )}
            </p>
          </div>
          {student.status === "ACTIVE" && payNow ? (
            <span className="flex flex-col items-end gap-1">
              <ButtonLink href={href(payNow.key)} icon={IndianRupee} size="lg">
                Collect {payNow.key === "arrears" ? "arrears" : payNow.label.split(" ")[0]} · {rupees(payNow.balance + payNow.late)}
              </ButtonLink>
              {unpaidCount > 1 && <span className="text-xs text-danger">{unpaidCount} months unpaid</span>}
            </span>
          ) : (
            totals.total > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                <CircleCheck className="h-4 w-4" /> Nothing due now
              </span>
            )
          )}
        </div>
      </section>

      {student.status !== "ACTIVE" && (
        <Card>
          <p className="text-sm text-fg-2">This student was removed, so no new payments can be taken.</p>
        </Card>
      )}

      <Card
        title={`Session ${session.name}`}
        description="Open a month to see its fees and collect."
        padded={false}
        action={<span className="text-sm text-muted">Paid {rupees(totals.paid)}</span>}
      >
        <ul className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 sm:p-4 xl:grid-cols-4">
          {months.map((m) => {
            const s = MONTH_STYLE[m.status];
            return (
              <li key={m.key} className={m.key === "arrears" ? "col-span-full" : undefined}>
                <Link href={href(m.key)} className={`group flex h-full flex-col rounded-xl border px-3 py-2.5 transition hover:-translate-y-px hover:shadow-card ${s.box}`}>
                  <span className="flex items-center justify-between gap-2 text-sm font-medium text-fg">
                    {m.key === "arrears" ? m.label : m.label.split(" ")[0]}
                    {m.status === "PAID" && <Check className="h-4 w-4 text-success" aria-hidden />}
                  </span>
                  <span className="mt-1 text-base font-semibold tabular-nums text-fg">
                    {m.status === "NONE" ? <span className="text-sm font-normal text-subtle">—</span> : rupees(m.status === "PAID" ? m.charged : m.balance + m.late)}
                  </span>
                  <span className={`mt-0.5 text-xs font-medium ${s.text}`}>{s.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card
        title="Receipts"
        icon={Receipt}
        padded={false}
        action={
          <Link href={`/admin/fees/students/${student.id}`} className="text-sm font-medium text-accent-text hover:underline">
            Detailed view
          </Link>
        }
      >
        {receipts.length === 0 ? (
          <p className="px-6 py-5 text-sm text-muted">No payments yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {receipts.slice(0, 5).map((r) => (
              <li key={r.id}>
                <Link href={`/admin/fees/receipts/${r.id}?from=desk`} className="flex items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-surface-2 sm:px-6">
                  <span className="font-mono text-xs font-medium text-accent-text">{r.number}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted">
                    {shortDate.format(r.date)} · {MODE_LABELS[r.mode]}
                    {r.session.name !== session.name && ` · ${r.session.name}`}
                  </span>
                  {r.cancelledAt ? <Badge tone="red">Cancelled</Badge> : <span className="font-semibold tabular-nums text-fg">{rupees(r.total)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

const MONTH_STYLE: Record<DeskMonthStatus, { label: string; box: string; text: string }> = {
  PAID: { label: "Paid", box: "border-success-line bg-success-soft/50", text: "text-success" },
  PARTIAL: { label: "Part paid", box: "border-warning-line bg-warning-soft/50", text: "text-warning" },
  OVERDUE: { label: "Overdue", box: "border-danger-line bg-danger-soft/50", text: "text-danger" },
  DUE: { label: "Due", box: "border-warning-line bg-warning-soft/40", text: "text-warning" },
  UPCOMING: { label: "Upcoming", box: "border-line bg-surface hover:border-line-strong", text: "text-muted" },
  NONE: { label: "No fees", box: "border-dashed border-line bg-surface opacity-60", text: "text-subtle" },
};
