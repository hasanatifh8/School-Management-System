import Link from "next/link";
import { ArrowLeft, BookOpenCheck, CircleCheck, Eye, HandCoins, LayoutList, Phone, Printer, Receipt, SearchCheck, Wallet } from "lucide-react";
import { Avatar, Badge, ButtonLink, Card, EmptyState, buttonVariants } from "@/components/ui";
import { parseISODate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { getFeesAccess, loadStudentAccount, outstandingByStudent } from "@/lib/fees";
import { MODE_LABELS, monthLabel, quickAmounts, rupees } from "@/lib/fees-shared";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";
import { quickCollect, type DeskStudent } from "./actions";
import { DeskCollect } from "./desk-collect";
import { DeskSearch } from "./desk-search";

const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * The Fee desk: a cashier's one-screen counter. Find a student on the left,
 * collect on the right (type the amount; it pays the oldest dues first), print
 * and move on. The classic Fees pages stay available for anything unusual.
 */
export default async function FeeDeskPage({ searchParams }: PageProps<"/admin/fee-desk">) {
  const sp = await searchParams;
  const { school, session, today, canManage } = await getFeesAccess();
  const selectedId = typeof sp.s === "string" ? sp.s : null;
  const receiptId = typeof sp.r === "string" ? sp.r : null;

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
  const [todayAgg, byMode, sections, lastReceipts, account, justMade] = await Promise.all([
    db.feeReceipt.aggregate({ where: valid, _sum: { total: true }, _count: true }),
    db.feeReceipt.groupBy({ by: ["mode"], where: valid, _sum: { total: true } }),
    db.section.findMany({ where: { class: { schoolId: school.id } }, orderBy: [{ class: { sortOrder: "asc" } }, { name: "asc" }], include: { class: true } }),
    db.feeReceipt.findMany({ where: { schoolId: school.id, studentId: { not: null } }, orderBy: { createdAt: "desc" }, take: 40, select: { studentId: true } }),
    selectedId ? loadStudentAccount(school.id, selectedId) : null,
    receiptId ? db.feeReceipt.findFirst({ where: { id: receiptId, schoolId: school.id }, select: { id: true, number: true, total: true, mode: true, studentId: true } }) : null,
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
          {justMade && (!account || justMade.studentId === account.student.id) && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-success-line bg-success-soft px-4 py-3">
              <CircleCheck className="h-5 w-5 shrink-0 text-success" />
              <p className="min-w-0 flex-1 text-sm text-fg">
                <strong className="font-semibold">{rupees(justMade.total)} collected</strong> by {MODE_LABELS[justMade.mode]} · receipt{" "}
                <span className="font-mono">{justMade.number}</span>
              </p>
              <a href={`/admin/fees/receipts/${justMade.id}?print=1`} target="_blank" rel="noopener" className={buttonVariants.primary}>
                <Printer className="h-4 w-4" /> Print
              </a>
              <Link href={`/admin/fees/receipts/${justMade.id}?from=desk`} className={buttonVariants.secondary}>
                <Eye className="h-4 w-4" /> View
              </Link>
            </div>
          )}

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
        <p className="text-sm text-muted">Find a student, enter what they pay, print the receipt.</p>
      </div>
      <ButtonLink href="/admin/fees" variant="ghost" icon={LayoutList}>
        Classic fees
      </ButtonLink>
    </div>
  );
}

/** The chosen student: who they are, what they owe, the collect form and recent receipts. */
function StudentPanel({ account, today }: { account: NonNullable<Awaited<ReturnType<typeof loadStudentAccount>>>; today: string }) {
  const { student, dues, totals, receipts, session } = account;
  const name = fullName(student);
  const quick = quickAmounts(dues, today);
  const admittedLate = student.admissionDate.toISOString().slice(0, 7) > session.startDate.toISOString().slice(0, 7);

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
              <span className="font-mono">{student.studentCode}</span>
              {student.section && <Badge tone="indigo">{sectionLabel(student.section)}</Badge>}
              {student.rollNumber != null && <span>Roll {student.rollNumber}</span>}
              {student.fatherName && <span>· {student.fatherName}</span>}
              {student.phone && (
                <a href={`tel:${student.phone}`} className="inline-flex items-center gap-1 font-medium text-accent-text hover:underline">
                  <Phone className="h-3.5 w-3.5" /> {student.phone}
                </a>
              )}
            </p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
          <Figure label="Due now" value={quick.dueNow} tone={quick.dueNow ? "text-danger" : "text-success"} />
          <Figure label="Left this session" value={quick.session} />
          <Figure label="Paid this session" value={totals.paid} tone="text-success" />
        </dl>
        {admittedLate && (
          <p className="mt-3 text-xs text-muted">
            Admitted {shortDate.format(student.admissionDate)} {student.admissionDate.getUTCFullYear()}
            {student.feesFrom ? `, fees from ${monthLabel(student.feesFrom.toISOString().slice(0, 7))}` : "; months before that aren't charged"}.{" "}
            <Link href={`/admin/fees/students/${student.id}`} className="font-medium text-accent-text hover:underline">
              Change
            </Link>
          </p>
        )}
      </section>

      {student.status !== "ACTIVE" ? (
        <Card>
          <p className="text-sm text-fg-2">This student was removed, so no new payments can be taken.</p>
        </Card>
      ) : (
        <DeskCollect
          key={dues.map((d) => `${d.headId}:${d.period}:${d.balance}`).join(",")}
          dues={dues}
          today={today}
          minDate={session.startDate.toISOString().slice(0, 10)}
          action={quickCollect.bind(null, student.id)}
        />
      )}

      <Card
        title="Recent receipts"
        icon={Receipt}
        padded={false}
        action={
          <span className="flex items-center gap-3 text-sm">
            <Link href={`/admin/fees/students/${student.id}/ledger`} className="inline-flex items-center gap-1 font-medium text-accent-text hover:underline">
              <BookOpenCheck className="h-4 w-4" /> Ledger
            </Link>
            <Link href={`/admin/fees/students/${student.id}`} className="font-medium text-accent-text hover:underline">
              Detailed view
            </Link>
          </span>
        }
      >
        {receipts.length === 0 ? (
          <p className="px-6 py-5 text-sm text-muted">No payments yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {receipts.slice(0, 5).map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm sm:px-6">
                <Link href={`/admin/fees/receipts/${r.id}?from=desk`} className="font-mono text-xs font-medium text-accent-text hover:underline">
                  {r.number}
                </Link>
                <span className="min-w-0 flex-1 truncate text-xs text-muted">
                  {shortDate.format(r.date)} · {MODE_LABELS[r.mode]}
                  {r.session.name !== session.name && ` · ${r.session.name}`}
                </span>
                {r.cancelledAt ? <Badge tone="red">Cancelled</Badge> : <span className="font-semibold tabular-nums text-fg">{rupees(r.total)}</span>}
                <a href={`/admin/fees/receipts/${r.id}?print=1`} target="_blank" rel="noopener" title="Print" aria-label={`Print receipt ${r.number}`} className="rounded-md p-1.5 text-subtle hover:bg-surface-3 hover:text-fg">
                  <Printer className="h-4 w-4" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function Figure({ label, value, tone = "text-fg" }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</dt>
      <dd className={`mt-0.5 text-lg font-semibold tabular-nums ${tone}`}>{rupees(value)}</dd>
    </div>
  );
}
