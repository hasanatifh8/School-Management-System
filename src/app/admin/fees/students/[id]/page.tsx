import Link from "next/link";
import { notFound } from "next/navigation";
import { Bus, Receipt } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar, Badge, Card, EmptyState } from "@/components/ui";
import { loadStudentAccount, getFeesAccess } from "@/lib/fees";
import { FREQUENCY_META, MODE_LABELS, rupees } from "@/lib/fees-shared";
import { fullName, sectionLabel } from "@/lib/queries";
import { collectFee, setOptionalFee } from "../../actions";
import { CollectForm } from "./collect-form";

const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** A student's fees for the session: what's due, collecting a payment, and past receipts. */
export default async function StudentFeesPage({ params }: PageProps<"/admin/fees/students/[id]">) {
  const { id } = await params;
  const { school } = await getFeesAccess();
  const account = await loadStudentAccount(school.id, id);
  if (!account) notFound();
  const { student, totals, dues, optionalHeads, receipts, today, session } = account;
  const name = fullName(student);
  const active = student.status === "ACTIVE";

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={name} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500">
              <Link href="/admin/fees/collect" className="hover:text-indigo-600">
                Collect fees
              </Link>{" "}
              ›
            </p>
            <h2 className="text-xl font-semibold text-slate-900">{name}</h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className="font-mono">{student.studentCode}</span>
              {student.section ? <Badge tone="indigo">{sectionLabel(student.section)}</Badge> : <Badge tone="amber">No class</Badge>}
              {student.rollNumber != null && <Badge>Roll {student.rollNumber}</Badge>}
              {student.fatherName && <span>Father: {student.fatherName}</span>}
              {student.phone && <span>· {student.phone}</span>}
              {!active && <Badge tone="red">Removed</Badge>}
            </p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-4">
          <Tile label={`Fees for ${session.name}`} value={rupees(totals.total)} />
          <Tile label="Paid" value={rupees(totals.paid)} tone="text-emerald-600" />
          <Tile label="Due now" value={rupees(totals.dueNow)} tone={totals.dueNow ? "text-rose-600" : "text-slate-900"} />
          <Tile label="Upcoming" value={rupees(totals.upcoming)} />
        </dl>
      </section>

      {!student.section && active && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">This student has no class, so no class fees apply. Assign a class first.</p>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {active ? (
            <CollectForm dues={dues} today={today} minDate={session.startDate.toISOString().slice(0, 10)} action={collectFee.bind(null, student.id)} />
          ) : (
            <Card>
              <p className="text-sm text-slate-600">This student was removed, so no new payments can be taken. Past receipts are listed alongside.</p>
            </Card>
          )}
        </div>

        <div className="space-y-6 self-start">
          {optionalHeads.length > 0 && active && (
            <Card title="Optional fees" icon={Bus} description="Charged only if the student uses them.">
              <ul className="space-y-3">
                {optionalHeads.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      <span className="font-medium text-slate-900">{h.name}</span>
                      <span className="block text-xs text-slate-500">
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
              <ul className="divide-y divide-slate-100">
                {receipts.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/fees/receipts/${r.id}`} className="flex items-center justify-between gap-3 px-6 py-3 text-sm hover:bg-slate-50">
                      <span>
                        <span className="font-mono text-xs font-medium text-indigo-600">{r.number}</span>
                        <span className="block text-xs text-slate-500">
                          {shortDate.format(r.date)} · {MODE_LABELS[r.mode]}
                          {r.session.name !== session.name && ` · ${r.session.name}`}
                        </span>
                      </span>
                      {r.cancelledAt ? <Badge tone="red">Cancelled</Badge> : <span className="font-semibold tabular-nums text-slate-900">{rupees(r.total)}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, tone = "text-slate-900" }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className={`mt-0.5 text-xl font-semibold tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
}
