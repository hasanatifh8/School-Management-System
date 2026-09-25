import Link from "next/link";
import { Copy, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, ButtonLink, Card, EmptyState, Table, tbodyClass, tdClass, thClass, theadClass } from "@/components/ui";
import { db } from "@/lib/db";
import { getFeesAccess, loadFeeHeads } from "@/lib/fees";
import { FREQUENCY_META, MONTH_NAMES, rupees } from "@/lib/fees-shared";
import { copyPreviousStructure, deleteFeeHead } from "../actions";

/** Every fee of the session against every class, with the yearly total per student. */
export default async function FeeStructurePage() {
  const { school, session, canManage } = await getFeesAccess();
  const [heads, classes, previous] = await Promise.all([
    loadFeeHeads(session.id),
    db.schoolClass.findMany({ where: { schoolId: school.id }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.academicSession.findFirst({
      where: { schoolId: school.id, id: { not: session.id }, startDate: { lt: session.startDate }, feeHeads: { some: {} } },
      orderBy: { startDate: "desc" },
      select: { name: true },
    }),
  ]);

  if (!heads.length) {
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
            <th className={`${thClass} sticky left-0 z-10 bg-slate-50`}>Fee</th>
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
              <td className={`${tdClass} sticky left-0 z-10 bg-white`}>
                <p className="font-medium text-slate-900">{h.name}</p>
                <p className="mt-1 flex flex-wrap gap-1">
                  <Badge tone="indigo">{FREQUENCY_META[h.frequency].short}</Badge>
                  {h.optional && <Badge tone="sky">Opt-in</Badge>}
                  <span className="text-xs text-slate-500">
                    {h.frequency === "YEARLY"
                      ? `due ${h.dueDay} ${MONTH_NAMES[(h.dueMonth ?? 4) - 1]}`
                      : h.frequency === "ONE_TIME"
                        ? "at admission"
                        : `due by the ${h.dueDay}${h.dueDay === 1 ? "st" : h.dueDay === 2 ? "nd" : h.dueDay === 3 ? "rd" : "th"}`}
                  </span>
                </p>
              </td>
              {classes.map((c) => (
                <td key={c.id} className={`${tdClass} text-right tabular-nums`}>
                  {h.amounts[c.id] ? rupees(h.amounts[c.id]) : <span className="text-slate-300">—</span>}
                </td>
              ))}
              {canManage && (
                <td className={`${tdClass} whitespace-nowrap`}>
                  <div className="flex items-center gap-1">
                    <Link href={`/admin/fees/structure/${h.id}`} title={`Edit ${h.name}`} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600">
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <ActionForm action={deleteFeeHead.bind(null, h.id)} compact className="flex flex-row-reverse items-center gap-2">
                      <SubmitButton variant="dangerGhost" size="sm" confirm={`Delete “${h.name}”?`} icon={<Trash2 className="h-4 w-4" />}>
                        <span className="sr-only">Delete {h.name}</span>
                      </SubmitButton>
                    </ActionForm>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-slate-200 bg-slate-50/80">
          <tr>
            <td className={`${tdClass} sticky left-0 z-10 bg-slate-50 font-semibold text-slate-900`}>
              Yearly per student
              <span className="block text-xs font-normal text-slate-500">Regular fees for the whole session</span>
            </td>
            {classes.map((c) => (
              <td key={c.id} className={`${tdClass} text-right font-semibold tabular-nums text-slate-900`}>
                {rupees(regular.reduce((n, h) => n + perYear(h, c.id), 0))}
              </td>
            ))}
            {canManage && <td />}
          </tr>
          {oneTime.length > 0 && (
            <tr>
              <td className={`${tdClass} sticky left-0 z-10 bg-slate-50 text-slate-700`}>+ one time for new admissions</td>
              {classes.map((c) => (
                <td key={c.id} className={`${tdClass} text-right tabular-nums text-slate-700`}>
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
