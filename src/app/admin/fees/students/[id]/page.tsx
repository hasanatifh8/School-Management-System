import Link from "next/link";
import { notFound } from "next/navigation";
import { Bus, Receipt, School, TriangleAlert } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar, Badge, Breadcrumbs, ButtonLink, Callout, Card, EmptyState, PagedList, ProgressBar } from "@/components/ui";
import { photoUrl } from "@/lib/photos";
import { loadStudentAccount, getFeesAccess } from "@/lib/fees";
import { FREQUENCY_META, MODE_LABELS, rupees } from "@/lib/fees-shared";
import { fullName, sectionLabel } from "@/lib/queries";
import { collectFee, setOptionalFee } from "../../actions";
import { CollectForm } from "./collect-form";

const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** A student's fees for the session: what's due, collecting a payment, and past receipts. */
export default async function StudentFeesPage({ params }: PageProps<"/admin/fees/students/[id]">) {
  const { id } = await params;
  const { school, canManage } = await getFeesAccess();
  const account = await loadStudentAccount(school.id, id);
  if (!account) notFound();
  const { student, totals, dues, optionalHeads, receipts, today, session } = account;
  const name = fullName(student);
  const active = student.status === "ACTIVE";

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={name} src={photoUrl(student.photoId)} size="lg" />
          <div className="min-w-0 flex-1">
            <Breadcrumbs items={[{ label: "Collect fees", href: "/admin/fees/collect" }, { label: name }]} />
            <h2 className="text-h2 font-semibold text-fg">
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
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-6 sm:grid-cols-4">
          <Tile label={`Fees for ${session.name}`} value={rupees(totals.total)} />
          <Tile label="Paid" value={rupees(totals.paid)} tone="text-success" />
          <Tile label="Due now" value={rupees(totals.dueNow)} tone={totals.dueNow ? "text-danger" : "text-fg"} />
          <Tile label="Upcoming" value={rupees(totals.upcoming)} />
        </dl>
        {totals.total > 0 && (
          <ProgressBar value={(totals.paid / totals.total) * 100} tone="success" className="mt-4" label="Share of the session's fees paid" />
        )}
      </section>

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
            <CollectForm dues={dues} today={today} minDate={session.startDate.toISOString().slice(0, 10)} action={collectFee.bind(null, student.id)} />
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
              description="Charged only if the student uses them. To add a fee for many students at once, use its link in the fee structure."
            >
              <ul className="space-y-3">
                {optionalHeads.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 text-sm">
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
      <dd className={`mt-1 text-xl font-semibold tabular-nums sm:text-2xl ${tone}`}>{value}</dd>
    </div>
  );
}
