import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpenCheck, Bus, CalendarClock, Receipt, School, TriangleAlert } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar, Badge, Breadcrumbs, ButtonLink, Callout, Card, EmptyState, PagedList, ProgressBar, selectClass } from "@/components/ui";
import { photoUrl } from "@/lib/photos";
import { loadStudentAccount, getFeesAccess } from "@/lib/fees";
import { FREQUENCY_META, MODE_LABELS, monthLabel, rupees, sessionMonths } from "@/lib/fees-shared";

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
import { fullName, sectionLabel } from "@/lib/queries";
import { collectFee, setFeesFrom, setOptionalFee, setOptionalFeeFrom } from "../../actions";
import { CollectForm } from "./collect-form";
import { FeesFromForm } from "./fees-from-form";

const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** A student's fees for the session: what's due, collecting a payment, and past receipts. */
export default async function StudentFeesPage({ params, searchParams }: PageProps<"/admin/fees/students/[id]">) {
  const { id } = await params;
  const { month: monthParam } = await searchParams;
  const { school, canManage } = await getFeesAccess();
  const account = await loadStudentAccount(school.id, id);
  if (!account) notFound();
  const { student, totals, dues, optionalHeads, receipts, today, session } = account;
  const name = fullName(student);
  const active = student.status === "ACTIVE";
  // Fees that can be charged for months before admission: recurring ones this student pays.
  const classId = student.section?.classId;
  const backChoices = account.heads
    .filter((h) => h.frequency !== "ONE_TIME" && classId && h.amounts[classId] && (!h.optional || optionalHeads.some((o) => o.id === h.id && o.added)))
    .map((h) => ({ id: h.id, name: h.name }));
  const admittedMidSession = isoDay(student.admissionDate).slice(0, 7) > isoDay(session.startDate).slice(0, 7);
  // The billing month: ?month= if it is in the session, else this month (or the session's nearest end).
  const months = sessionMonths(session.startDate.toISOString().slice(0, 10));
  const thisMonth = today.slice(0, 7);
  const targetMonth =
    typeof monthParam === "string" && months.includes(monthParam)
      ? monthParam
      : months.includes(thisMonth)
        ? thisMonth
        : thisMonth < months[0]
          ? months[0]
          : months[11];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={name} src={photoUrl(student.photoId)} size="md" />
          <div className="min-w-0 flex-1">
            <Breadcrumbs
              items={[
                { label: "Collect fees", href: "/admin/fees/collect" },
                ...(student.section ? [{ label: sectionLabel(student.section), href: `/admin/fees/collect?section=${student.section.id}` }] : []),
                { label: name },
              ]}
            />
            <h2 className="text-lg font-semibold text-fg">
              <Link href={`/admin/students/${student.id}`} className="rounded transition hover:text-accent-text">
                {name}
              </Link>
            </h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span className="font-mono">{student.studentCode}</span>
              {student.section ? <Badge tone="indigo">{sectionLabel(student.section)}</Badge> : <Badge tone="amber">No class</Badge>}
              {student.rollNumber != null && <Badge>Roll {student.rollNumber}</Badge>}
              {student.fatherName && <span>Father: {student.fatherName}</span>}
              {student.phone && <span>· {student.phone}</span>}
              {!active && <Badge tone="red">Removed</Badge>}
            </p>
          </div>
          <ButtonLink href={`/admin/fees/students/${student.id}/ledger`} variant="secondary" icon={BookOpenCheck}>
            Fee ledger
          </ButtonLink>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
          <Tile label={`Fees for ${session.name}`} value={rupees(totals.total)} />
          <Tile label="Paid" value={rupees(totals.paid)} tone="text-success" />
          <Tile label="Due now" value={rupees(totals.dueNow)} tone={totals.dueNow ? "text-danger" : "text-fg"} />
          <Tile label="Upcoming" value={rupees(totals.upcoming)} />
          {account.arrearsTotal > 0 && <Tile label="Arrears (last session)" value={rupees(account.arrearsTotal)} tone="text-danger" />}
        </dl>
        {totals.total > 0 && (
          <ProgressBar value={(totals.paid / totals.total) * 100} tone="success" className="mt-3" label="Share of the session's fees paid" />
        )}
      </section>

      {/* A student admitted mid-session is charged from the admission month, unless fees staff choose otherwise. */}
      {active && (admittedMidSession || student.feesFrom) && (
        <Callout icon={CalendarClock} tone="info">
          <div className="space-y-3">
            <p>
              Admitted on <strong className="font-semibold">{shortDate.format(student.admissionDate)}</strong>.{" "}
              {student.feesFrom ? (
                <>
                  Fees are charged from <strong className="font-semibold">{monthLabel(isoDay(student.feesFrom).slice(0, 7))}</strong>
                  {student.feesFromHeadIds.length > 0 &&
                    `, for ${backChoices
                      .filter((h) => student.feesFromHeadIds.includes(h.id))
                      .map((h) => h.name)
                      .join(", ")} only before admission`}
                  .
                </>
              ) : (
                <>Fees are charged from the admission month; earlier months of the session aren&apos;t billed.</>
              )}
            </p>
            <FeesFromForm
              action={setFeesFrom.bind(null, student.id)}
              months={months}
              admissionMonth={isoDay(student.admissionDate).slice(0, 7)}
              current={student.feesFrom ? isoDay(student.feesFrom).slice(0, 7) : ""}
              heads={backChoices}
              picked={student.feesFromHeadIds}
            />
          </div>
        </Callout>
      )}

      {/* Fees paid before the class was removed still list; say why nothing new is charged. */}
      {!student.section && active && dues.length > 0 && (
        <Callout icon={TriangleAlert} tone="warning">
          This student has no class, so no class fees apply. Assign a class first.
        </Callout>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {active && dues.length === 0 ? (
            // Fees are set per class, so there is nothing to collect yet: say why
            // rather than showing "All paid up".
            <Card>
              {student.section ? (
                <EmptyState
                  icon={Receipt}
                  title={`No fees set for ${student.section.class.name}`}
                  description="Add this class's amounts in the fee structure, then collect here."
                  action={
                    canManage && (
                      <ButtonLink href="/admin/fees/structure" variant="secondary">
                        Open fee structure
                      </ButtonLink>
                    )
                  }
                />
              ) : (
                <EmptyState
                  icon={School}
                  title="No class assigned"
                  description="Fees are set per class, so none apply yet. Assign a class to this student, then collect the admission fee here."
                  action={
                    canManage && (
                      <ButtonLink href={`/admin/students/${student.id}?tab=edit`}>Assign a class</ButtonLink>
                    )
                  }
                />
              )}
            </Card>
          ) : active ? (
            <CollectForm
              // Start afresh when the month or the dues change (e.g. an opt-in fee was added),
              // so new instalments are ticked and filled in like the rest.
              key={`${targetMonth}|${dues.map((d) => `${d.headId}:${d.period}:${d.balance}`).join(",")}`}
              dues={dues}
              today={today}
              minDate={session.startDate.toISOString().slice(0, 10)}
              targetMonth={targetMonth}
              months={months}
              action={collectFee.bind(null, student.id)}
            />
          ) : (
            <Card>
              <p className="text-sm text-fg-2">This student was removed, so no new payments can be taken. Past receipts are listed alongside.</p>
            </Card>
          )}
        </div>

        <div className="space-y-6 self-start">
          {optionalHeads.length > 0 && active && (
            <Card
              title="Optional fees"
              icon={Bus}
              description="Charged only if the student uses them."
            >
              <ul className="space-y-3">
                {optionalHeads.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                    <span>
                      <span className="font-medium text-fg">{h.name}</span>
                      <span className="block text-xs text-muted">
                        {rupees(h.amount)} · {FREQUENCY_META[h.frequency].short}
                      </span>
                    </span>
                    <ActionForm action={setOptionalFee.bind(null, student.id, h.id, !h.added)} compact className="flex flex-col items-end gap-1">
                      <SubmitButton variant={h.added ? "ghost" : "secondary"} size="sm" confirm={h.added ? `Stop charging ${h.name}?` : undefined}>
                        {h.added ? "Remove" : "Add"}
                      </SubmitButton>
                    </ActionForm>
                    {h.added && (
                      <ActionForm action={setOptionalFeeFrom.bind(null, student.id, h.id)} compact className="flex w-full flex-wrap items-center gap-2 text-xs">
                        <label className="flex items-center gap-1.5 text-muted">
                          From
                          <select name="from" defaultValue={h.from ?? ""} className={`${selectClass} !w-40 !py-1 text-xs`}>
                            <option value="">Whole session</option>
                            {months.map((m) => (
                              <option key={m} value={m}>
                                {monthLabel(m)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <SubmitButton variant="ghost" size="sm">
                          Save
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Receipts" icon={Receipt} padded={false}>
            {receipts.length === 0 ? (
              <EmptyState icon={Receipt} title="No payments yet" />
            ) : (
              <PagedList pageSize={8} noun="receipts">
                {receipts.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/fees/receipts/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition hover:bg-surface-2 sm:px-6">
                      <span>
                        <span className="font-mono text-xs font-medium text-accent-text">{r.number}</span>
                        <span className="block text-xs text-muted">
                          {shortDate.format(r.date)} · {MODE_LABELS[r.mode]}
                          {r.session.name !== session.name && ` · ${r.session.name}`}
                        </span>
                      </span>
                      {r.cancelledAt ? <Badge tone="red">Cancelled</Badge> : <span className="font-semibold tabular-nums text-fg">{rupees(r.total)}</span>}
                    </Link>
                  </li>
                ))}
              </PagedList>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, tone = "text-fg" }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="text-eyebrow uppercase text-muted">{label}</dt>
      <dd className={`mt-0.5 text-lg font-semibold tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
}
