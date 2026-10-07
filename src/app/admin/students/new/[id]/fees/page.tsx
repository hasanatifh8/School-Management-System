import Link from "next/link";
import { Bus, CircleCheck, Receipt } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { buttonVariants, ButtonLink, Callout, Card, checkboxClass, EmptyState, FormActions, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { loadStudentAccount } from "@/lib/fees";
import { FREQUENCY_META, rupees } from "@/lib/fees-shared";
import { formatTime } from "@/lib/timetable-shared";
import { admissionFees } from "../../actions";
import { AdmissionSteps } from "../../admission-steps";
import { AdmissionStudent, loadAdmission } from "../admission-student";

const TRANSPORT_FEE = /transport|bus|van|conveyance/i;

/** Admission step 3: the class's fees (charged automatically) and the opt-in fees to tick. */
export default async function AdmissionFeesPage({ params }: PageProps<"/admin/students/new/[id]/fees">) {
  const { id } = await params;
  const { school, student } = await loadAdmission(id);
  const [account, route] = await Promise.all([
    loadStudentAccount(school.id, id),
    student.transportRouteId ? db.transportRoute.findUnique({ where: { id: student.transportRouteId } }) : null,
  ]);
  const classId = student.section?.classId;
  const heads = account?.heads ?? [];
  const classFees = classId ? heads.filter((h) => !h.optional && h.amounts[classId] > 0) : [];
  // The transport fee follows the bus chosen in step 2; the rest are ticked here.
  const transportFee = account?.optionalHeads.find((h) => h.transport && h.added);
  const optional = account?.optionalHeads.filter((h) => !h.transport) ?? [];
  const hasTransportFee = heads.some((h) => h.transport);
  const finish = `/admin/students/${student.id}/acknowledgement?new=1`;
  const stopIndex = route && student.transportStop ? route.stops.indexOf(student.transportStop) : -1;
  // On a bus, no opt-in chosen yet, and no fee linked to Transport: suggest a class-wise transport fee.
  const suggest = (name: string) => !!route && !hasTransportFee && !optional.some((o) => o.added) && TRANSPORT_FEE.test(name);

  return (
    <>
      <PageHeader
        title="New admission"
        subtitle="Class fees apply automatically. Tick any optional fees the student should pay."
        breadcrumbs={[{ label: "Students", href: "/admin/students" }, { label: "New admission" }]}
      />
      <AdmissionSteps current={3} />
      <Card>
        <AdmissionStudent student={student} />
        <ActionForm action={admissionFees.bind(null, student.id)} className="space-y-6 pt-5">
          {!classId ? (
            <EmptyState
              icon={Receipt}
              title="No class assigned"
              description="Fees are set per class, so none apply yet. Assign a class from the student's profile, then add fees there."
            />
          ) : (
            <>
              <section>
                <h2 className="mb-2 text-sm font-semibold text-fg">Class fees · {student.section!.class.name}</h2>
                {classFees.length === 0 && !transportFee ? (
                  <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">
                    No fees are set for {student.section!.class.name} this session.{" "}
                    <Link href="/admin/fees/structure" className="font-medium text-accent-text hover:underline">
                      Open fee structure
                    </Link>
                  </p>
                ) : (
                  <ul className="divide-y divide-line rounded-xl border border-line">
                    {classFees.map((h) => (
                      <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                        <span className="flex items-center gap-2">
                          <CircleCheck className="h-4 w-4 text-success" aria-hidden />
                          <span className="font-medium text-fg">{h.name}</span>
                          <span className="text-muted">· {FREQUENCY_META[h.frequency].short}</span>
                        </span>
                        <span className="font-semibold tabular-nums text-fg">{rupees(h.amounts[classId])}</span>
                      </li>
                    ))}
                    {transportFee && (
                      <li className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                        <span className="flex items-center gap-2">
                          <Bus className="h-4 w-4 text-success" aria-hidden />
                          <span className="font-medium text-fg">{transportFee.name}</span>
                          <span className="text-muted">· {FREQUENCY_META[transportFee.frequency].short} · from Transport</span>
                        </span>
                        <span className="font-semibold tabular-nums text-fg">{rupees(transportFee.amount)}</span>
                      </li>
                    )}
                  </ul>
                )}
                <p className="mt-1.5 text-xs text-muted">
                  Charged to every student of the class, from the admission month{transportFee && "; the transport fee is the fare of the student's stop"}.
                </p>
              </section>

              <section>
                <h2 className="mb-2 text-sm font-semibold text-fg">Optional fees</h2>
                {route && (
                  <Callout icon={Bus} tone="info" className="mb-3">
                    On route <strong className="font-semibold">{route.routeNumber}</strong>
                    {student.transportStop && <>, {student.transportStop}</>}
                    {stopIndex >= 0 && route.stopTimes[stopIndex] && <> (pick-up {formatTime(route.stopTimes[stopIndex])})</>}
                    {stopIndex >= 0 && route.stopFares[stopIndex] > 0 && <>; the stop&apos;s fare is {rupees(route.stopFares[stopIndex])} a month</>}.
                    {!transportFee && hasTransportFee && " The stop has no fare set, so no transport fee is charged."}
                  </Callout>
                )}
                {optional.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">No optional fees for this class.</p>
                ) : (
                  <ul className="divide-y divide-line rounded-xl border border-line">
                    {optional.map((h) => (
                      <li key={h.id}>
                        <label className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm transition hover:bg-surface-2">
                          <span className="flex items-center gap-3">
                            <input type="checkbox" name="headIds" value={h.id} defaultChecked={h.added || suggest(h.name)} className={checkboxClass} />
                            <span>
                              <span className="font-medium text-fg">{h.name}</span>
                              <span className="text-muted"> · {FREQUENCY_META[h.frequency].short}</span>
                            </span>
                          </span>
                          <span className="font-semibold tabular-nums text-fg">{rupees(h.amount)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-1.5 text-xs text-muted">Ticked fees are charged from the admission month. You can change them later on the student&apos;s fee page.</p>
              </section>
            </>
          )}

          <FormActions note="Optional fees can be added later too.">
            <Link href={finish} className={buttonVariants.secondary}>
              Skip
            </Link>
            <SubmitButton icon={<CircleCheck className="h-4 w-4" />}>Finish admission</SubmitButton>
          </FormActions>
        </ActionForm>
      </Card>
      <p className="mt-4 text-center text-xs text-muted">
        Need to change the bus?{" "}
        <ButtonLink href={`/admin/students/new/${student.id}/transport`} variant="ghost" size="sm">
          Back to transport
        </ButtonLink>
      </p>
    </>
  );
}
