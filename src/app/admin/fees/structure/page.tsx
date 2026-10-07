import Link from "next/link";
import { Copy, Pencil, Plus, Trash2, Users, Wallet } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, ButtonLink, Card, EmptyState, Table, tbodyClass, tdClass, thClass, theadClass } from "@/components/ui";
import { db } from "@/lib/db";
import { getFeesAccess, loadFeeHeads } from "@/lib/fees";
import { FREQUENCY_META, MONTH_NAMES, rupees } from "@/lib/fees-shared";
import { copyPreviousStructure, deleteFeeHead } from "../actions";

/** Every fee of the session against every class, with the yearly total per student. */
export default async function FeeStructurePage() {
  const { school, session, canManage } = await getFeesAccess();
  const [heads, classes, previous, optedIn, routes] = await Promise.all([
    loadFeeHeads(session.id),
    db.schoolClass.findMany({ where: { schoolId: school.id }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.academicSession.findFirst({
      where: { schoolId: school.id, id: { not: session.id }, startDate: { lt: session.startDate }, feeHeads: { some: {} } },
      orderBy: { startDate: "desc" },
      select: { name: true },
    }),
    db.studentFeeHead.groupBy({ by: ["headId"], where: { head: { sessionId: session.id }, student: { status: "ACTIVE" } }, _count: true }),
    db.transportRoute.findMany({ where: { schoolId: school.id }, select: { stopFares: true } }),
  ]);
  const fares = routes.flatMap((r) => r.stopFares).filter((f) => f > 0);
  const fareRange = fares.length ? (Math.min(...fares) === Math.max(...fares) ? rupees(fares[0]) : `${rupees(Math.min(...fares))}–${rupees(Math.max(...fares))}`) : null;
  const payers = new Map(optedIn.map((o) => [o.headId, o._count]));

  // The transport fee is created on its own, so it alone doesn't count as a fee structure.
  if (!heads.some((h) => !h.transport)) {
    return (
      <Card>
        <EmptyState
          icon={Wallet}
          title={`No fees set up for ${session.name}`}
          description={
            canManage
              ? "Add each fee the school charges (tuition, admission, transport, exam fee…) with its amount for every class."
              : "Ask the school admin to set up the fee structure."
          }
          action={
            canManage && (
              <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink href="/admin/fees/structure/new" icon={Plus}>
                  Add a fee
                </ButtonLink>
                {previous && (
                  <ActionForm action={copyPreviousStructure} compact className="flex flex-col items-center gap-2">
                    <SubmitButton variant="secondary" icon={<Copy className="h-4 w-4" />}>
                      Copy fees from {previous.name}
                    </SubmitButton>
                  </ActionForm>
                )}
              </div>
            )
          }
        />
      </Card>
    );
  }

  const perYear = (h: (typeof heads)[number], classId: string) => (h.amounts[classId] ?? 0) * FREQUENCY_META[h.frequency].periods;
  const regular = heads.filter((h) => !h.optional && h.frequency !== "ONE_TIME");
  const oneTime = heads.filter((h) => !h.optional && h.frequency === "ONE_TIME");

  return (
    <Card
      title="Fee structure"
      description="Amounts are per instalment. Blank means the class isn't charged."
      padded={false}
      action={
        canManage && (
          <ButtonLink href="/admin/fees/structure/new" icon={Plus}>
            Add a fee
          </ButtonLink>
        )
      }
    >
      <Table>
        <thead className={theadClass}>
          <tr>
            <th className={`${thClass} sticky left-0 z-10 bg-surface-2`}>Fee</th>
            {classes.map((c) => (
              <th key={c.id} className={`${thClass} text-right`}>
                {c.name}
              </th>
            ))}
            {canManage && (
              <th className={thClass}>
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className={tbodyClass}>
          {heads.map((h) => (
            <tr key={h.id}>
              <td className={`${tdClass} sticky left-0 z-10 bg-surface`}>
                <p className="font-medium text-fg">{h.name}</p>
                <p className="mt-1 flex flex-wrap gap-1">
                  <Badge tone="indigo">{FREQUENCY_META[h.frequency].short}</Badge>
                  {h.transport ? <Badge tone="green">From Transport</Badge> : h.optional && <Badge tone="sky">Opt-in</Badge>}
                  <span className="text-xs text-muted">
                    {h.frequency === "YEARLY"
                      ? `due ${h.dueDay} ${MONTH_NAMES[(h.dueMonth ?? 4) - 1]}`
                      : h.frequency === "ONE_TIME"
                        ? "at admission"
                        : `due by the ${h.dueDay}${h.dueDay === 1 ? "st" : h.dueDay === 2 ? "nd" : h.dueDay === 3 ? "rd" : "th"}`}
                    {h.lateFee > 0 && ` · late fee ${rupees(h.lateFee)}${h.lateFeeMonthly ? " a month" : ""}`}
                  </span>
                </p>
                {h.optional && (
                  <Link
                    href={h.transport ? "/admin/transport" : `/admin/fees/structure/${h.id}/students`}
                    className="mt-1.5 inline-flex items-center gap-1 rounded text-xs font-medium text-accent-text hover:underline"
                  >
                    <Users className="h-3.5 w-3.5" />
                    {payers.get(h.id) ?? 0} student(s) · {h.transport ? "managed in Transport" : "Add or remove"}
                  </Link>
                )}
              </td>
              {h.transport ? (
                <td colSpan={classes.length} className={`${tdClass} text-sm text-muted`}>
                  Each student on a bus pays their stop&apos;s fare{fareRange ? ` (${fareRange} a month)` : ""}. Set fares and students in{" "}
                  <Link href="/admin/transport" className="font-medium text-accent-text hover:underline">
                    Transport
                  </Link>
                  .
                </td>
              ) : (
                classes.map((c) => (
                  <td key={c.id} className={`${tdClass} text-right tabular-nums`}>
                    {h.amounts[c.id] ? rupees(h.amounts[c.id]) : <span className="text-subtle">—</span>}
                  </td>
                ))
              )}
              {canManage && (
                <td className={`${tdClass} whitespace-nowrap`}>
                  <div className="flex items-center gap-1">
                    <Link href={`/admin/fees/structure/${h.id}`} title={`Edit ${h.name}`} className="rounded-md p-1.5 text-subtle hover:bg-surface-3 hover:text-accent-text">
                      <Pencil className="h-4 w-4" />
                    </Link>
                    {/* The transport fee follows the buses, so it can't be deleted. */}
                    {!h.transport && (
                      <ActionForm action={deleteFeeHead.bind(null, h.id)} compact className="flex flex-row-reverse items-center gap-2">
                        <SubmitButton variant="dangerGhost" size="sm" confirm={`Delete “${h.name}”?`} icon={<Trash2 className="h-4 w-4" />}>
                          <span className="sr-only">Delete {h.name}</span>
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-line bg-surface-2/80">
          <tr>
            <td className={`${tdClass} sticky left-0 z-10 bg-surface-2 font-semibold text-fg`}>
              Yearly per student
              <span className="block text-xs font-normal text-muted">Regular fees for the whole session</span>
            </td>
            {classes.map((c) => (
              <td key={c.id} className={`${tdClass} text-right font-semibold tabular-nums text-fg`}>
                {rupees(regular.reduce((n, h) => n + perYear(h, c.id), 0))}
              </td>
            ))}
            {canManage && <td />}
          </tr>
          {oneTime.length > 0 && (
            <tr>
              <td className={`${tdClass} sticky left-0 z-10 bg-surface-2 text-fg-2`}>+ one time for new admissions</td>
              {classes.map((c) => (
                <td key={c.id} className={`${tdClass} text-right tabular-nums text-fg-2`}>
                  {rupees(oneTime.reduce((n, h) => n + perYear(h, c.id), 0))}
                </td>
              ))}
              {canManage && <td />}
            </tr>
          )}
        </tfoot>
      </Table>
    </Card>
  );
}
