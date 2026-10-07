import Link from "next/link";
import { ChevronRight, Copy, LayoutGrid, Pencil, Plus, School, Table2, Trash2, Users, Wallet } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Breadcrumbs, ButtonLink, Card, EmptyState, IconTile, Table, tbodyClass, tdClass, thClass, theadClass } from "@/components/ui";
import { db } from "@/lib/db";
import { getFeesAccess, loadFeeHeads } from "@/lib/fees";
import { FREQUENCY_META, INSTALMENT_GAP, MONTH_NAMES, dueMonthsOf, rupees } from "@/lib/fees-shared";
import { copyPreviousStructure, deleteFeeHead } from "../actions";

/**
 * The session's fee structure: a card per class (its yearly total and fees);
 * a class opens its own fees; "Compare all classes" shows every fee against
 * every class side by side.
 */
export default async function FeeStructurePage({ searchParams }: PageProps<"/admin/fees/structure">) {
  const sp = await searchParams;
  const { school, session, canManage } = await getFeesAccess();
  const [heads, classes, previous, optedIn, routes, sections] = await Promise.all([
    loadFeeHeads(session.id),
    db.schoolClass.findMany({ where: { schoolId: school.id }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.academicSession.findFirst({
      where: { schoolId: school.id, id: { not: session.id }, startDate: { lt: session.startDate }, feeHeads: { some: {} } },
      orderBy: { startDate: "desc" },
      select: { name: true },
    }),
    db.studentFeeHead.groupBy({ by: ["headId"], where: { head: { sessionId: session.id }, student: { status: "ACTIVE" } }, _count: true }),
    db.transportRoute.findMany({ where: { schoolId: school.id }, select: { stopFares: true } }),
    db.section.findMany({ where: { class: { schoolId: school.id } }, select: { classId: true, _count: { select: { students: { where: { status: "ACTIVE" } } } } } }),
  ]);
  const students = new Map<string, number>();
  for (const sec of sections) students.set(sec.classId, (students.get(sec.classId) ?? 0) + sec._count.students);
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

  const cls = typeof sp.class === "string" ? classes.find((c) => c.id === sp.class) : undefined;
  if (sp.view === "all") return <MatrixView heads={heads} classes={classes} canManage={canManage} payers={payers} fareRange={fareRange} session={session} />;
  if (cls) return <ClassView cls={cls} heads={heads} canManage={canManage} payers={payers} fareRange={fareRange} session={session} />;
  return <ClassCards heads={heads} classes={classes} canManage={canManage} students={students} />;
}

type Heads = Awaited<ReturnType<typeof loadFeeHeads>>;
type ClassRow = { id: string; name: string };

/** Every fee against every class side by side: amounts per instalment and the yearly total per student. */
function MatrixView({
  heads,
  classes,
  canManage,
  payers,
  fareRange,
  session,
}: {
  heads: Heads;
  classes: ClassRow[];
  canManage: boolean;
  payers: Map<string, number>;
  fareRange: string | null;
  session: { startDate: Date };
}) {
  const perYear = (h: (typeof heads)[number], classId: string) => (h.amounts[classId] ?? 0) * FREQUENCY_META[h.frequency].periods;
  const regular = heads.filter((h) => !h.optional && h.frequency !== "ONE_TIME");
  const oneTime = heads.filter((h) => !h.optional && h.frequency === "ONE_TIME");

  return (
    <Card
      title="All classes"
      description="Amounts are per instalment. Blank means the class isn't charged."
      padded={false}
      action={
        <span className="flex flex-wrap gap-2">
          <ButtonLink href="/admin/fees/structure" variant="secondary" icon={LayoutGrid}>
            By class
          </ButtonLink>
          {canManage && (
            <ButtonLink href="/admin/fees/structure/new" icon={Plus}>
              Add a fee
            </ButtonLink>
          )}
        </span>
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
                    {INSTALMENT_GAP[h.frequency]
                      ? `due ${h.dueDay} ${dueMonthsOf(h.frequency, h.dueMonth, session.startDate.getUTCMonth() + 1)
                          .map((m) => MONTH_NAMES[m - 1])
                          .join(", ")}`
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

type Head = Heads[number];

const perYearOf = (h: Head, classId: string) => (h.amounts[classId] ?? 0) * FREQUENCY_META[h.frequency].periods;
const ordinal = (n: number) => `${n}${n === 1 || n === 21 ? "st" : n === 2 || n === 22 ? "nd" : n === 3 || n === 23 ? "rd" : "th"}`;

/** "due 10 Apr, Oct", "at admission", "due by the 10th". */
function dueText(h: Head, startMonth: number) {
  if (h.frequency === "ONE_TIME") return "at admission";
  if (INSTALMENT_GAP[h.frequency])
    return `due ${h.dueDay} ${dueMonthsOf(h.frequency, h.dueMonth, startMonth)
      .map((m) => MONTH_NAMES[m - 1])
      .join(", ")}`;
  return `due by the ${ordinal(h.dueDay)}`;
}

/** One card per class: its yearly fees per student, one-time fees and how many fees apply. */
function ClassCards({ heads, classes, canManage, students }: { heads: Heads; classes: ClassRow[]; canManage: boolean; students: Map<string, number> }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-fg">Fee structure by class</h2>
          <p className="text-sm text-muted">Open a class to see and change its fees.</p>
        </div>
        <span className="flex flex-wrap gap-2">
          <ButtonLink href="/admin/fees/structure?view=all" variant="secondary" icon={Table2}>
            Compare all classes
          </ButtonLink>
          {canManage && (
            <ButtonLink href="/admin/fees/structure/new" icon={Plus}>
              Add a fee
            </ButtonLink>
          )}
        </span>
      </div>
      {classes.length === 0 ? (
        <Card>
          <EmptyState icon={School} title="No classes yet" description="Create classes first; fees are set for each class." />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((c) => {
            const charged = heads.filter((h) => !h.transport && h.amounts[c.id] > 0);
            const yearly = charged.filter((h) => !h.optional && h.frequency !== "ONE_TIME").reduce((n, h) => n + perYearOf(h, c.id), 0);
            const oneTime = charged.filter((h) => !h.optional && h.frequency === "ONE_TIME").reduce((n, h) => n + h.amounts[c.id], 0);
            const optIn = charged.filter((h) => h.optional).length + (heads.some((h) => h.transport) ? 1 : 0);
            const regularCount = charged.filter((h) => !h.optional).length;
            return (
              <li key={c.id}>
                <Link
                  href={`/admin/fees/structure?class=${c.id}`}
                  className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-4 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-3">
                      <IconTile icon={School} tone="indigo" />
                      <span>
                        <span className="block font-semibold text-fg">{c.name}</span>
                        <span className="block text-xs text-muted">{students.get(c.id) ?? 0} students</span>
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-subtle transition group-hover:translate-x-0.5 group-hover:text-accent-text" />
                  </span>
                  {charged.length === 0 ? (
                    <span className="mt-4 text-sm text-warning">No fees set for this class yet</span>
                  ) : (
                    <>
                      <span className="mt-4 text-2xl font-semibold tabular-nums text-fg">{rupees(yearly)}</span>
                      <span className="text-xs text-muted">a year per student{oneTime > 0 && ` · + ${rupees(oneTime)} at admission`}</span>
                      <span className="mt-3 flex flex-wrap gap-1.5">
                        <Badge tone="indigo">
                          {regularCount} fee{regularCount === 1 ? "" : "s"}
                        </Badge>
                        {optIn > 0 && <Badge tone="sky">{optIn} opt-in</Badge>}
                      </span>
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** One class's fees: regular, one-time and opt-in, each with its amount for the class, and the yearly total. */
function ClassView({
  cls,
  heads,
  canManage,
  payers,
  fareRange,
  session,
}: {
  cls: ClassRow;
  heads: Heads;
  canManage: boolean;
  payers: Map<string, number>;
  fareRange: string | null;
  session: { startDate: Date };
}) {
  const startMonth = session.startDate.getUTCMonth() + 1;
  const charged = heads.filter((h) => h.transport || h.amounts[cls.id] > 0);
  const groups = [
    { title: "Regular fees", hint: "Every student of the class", rows: charged.filter((h) => !h.optional && h.frequency !== "ONE_TIME") },
    { title: "One-time fees", hint: "New admissions only", rows: charged.filter((h) => !h.optional && h.frequency === "ONE_TIME") },
    { title: "Opt-in fees", hint: "Only students who take them", rows: charged.filter((h) => h.optional) },
  ].filter((g) => g.rows.length);
  const notCharged = heads.filter((h) => !h.transport && !(h.amounts[cls.id] > 0));
  const yearly = charged.filter((h) => !h.optional && h.frequency !== "ONE_TIME").reduce((n, h) => n + perYearOf(h, cls.id), 0);
  const oneTime = charged.filter((h) => !h.optional && h.frequency === "ONE_TIME").reduce((n, h) => n + h.amounts[cls.id], 0);

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: "Fee structure", href: "/admin/fees/structure" }, { label: cls.name }]} />
      <Card
        title={`${cls.name} fees`}
        description={`Session fees for ${cls.name}. A fee's amounts for other classes are on the same form.`}
        padded={false}
        action={
          canManage && (
            <ButtonLink href={`/admin/fees/structure/new?class=${cls.id}`} icon={Plus}>
              Add a fee
            </ButtonLink>
          )
        }
      >
        {groups.length === 0 ? (
          <EmptyState icon={Wallet} title={`No fees set for ${cls.name}`} description="Add a fee, or give an existing fee an amount for this class." />
        ) : (
          <Table>
            <thead className={theadClass}>
              <tr>
                <th className={thClass}>Fee</th>
                <th className={thClass}>How often</th>
                <th className={`${thClass} text-right`}>Amount</th>
                <th className={`${thClass} text-right`}>A year</th>
                {canManage && (
                  <th className={thClass}>
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.title} className={tbodyClass}>
                <tr className="bg-surface-2/60">
                  <td colSpan={canManage ? 5 : 4} className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted sm:px-6">
                    {g.title} <span className="font-normal normal-case tracking-normal">· {g.hint}</span>
                  </td>
                </tr>
                {g.rows.map((h) => (
                  <tr key={h.id}>
                    <td className={tdClass}>
                      <p className="font-medium text-fg">{h.name}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {dueText(h, startMonth)}
                        {h.lateFee > 0 && ` · late fee ${rupees(h.lateFee)}${h.lateFeeMonthly ? " a month" : ""}`}
                        {h.optional && ` · ${payers.get(h.id) ?? 0} student(s) in all classes`}
                      </p>
                    </td>
                    <td className={tdClass}>
                      <span className="flex flex-wrap gap-1">
                        <Badge tone="indigo">{FREQUENCY_META[h.frequency].short}</Badge>
                        {h.transport && <Badge tone="green">From Transport</Badge>}
                      </span>
                    </td>
                    <td className={`${tdClass} text-right font-semibold tabular-nums text-fg`}>
                      {h.transport ? <span className="text-sm font-normal text-muted">Stop fare{fareRange && ` (${fareRange})`}</span> : rupees(h.amounts[cls.id])}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums text-muted`}>{h.transport || h.frequency === "ONE_TIME" ? "—" : rupees(perYearOf(h, cls.id))}</td>
                    {canManage && (
                      <td className={`${tdClass} whitespace-nowrap`}>
                        <div className="flex items-center justify-end gap-1">
                          {h.optional && (
                            <Link
                              href={h.transport ? "/admin/transport" : `/admin/fees/structure/${h.id}/students`}
                              title="Students"
                              className="rounded-md p-1.5 text-subtle hover:bg-surface-3 hover:text-accent-text"
                            >
                              <Users className="h-4 w-4" />
                            </Link>
                          )}
                          <Link href={`/admin/fees/structure/${h.id}?class=${cls.id}`} title={`Edit ${h.name}`} className="rounded-md p-1.5 text-subtle hover:bg-surface-3 hover:text-accent-text">
                            <Pencil className="h-4 w-4" />
                          </Link>
                          {!h.transport && (
                            <ActionForm action={deleteFeeHead.bind(null, h.id)} compact className="flex flex-row-reverse items-center gap-2">
                              <SubmitButton variant="dangerGhost" size="sm" confirm={`Delete “${h.name}” for every class?`} icon={<Trash2 className="h-4 w-4" />}>
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
            ))}
            <tfoot className="border-t-2 border-line bg-surface-2/80">
              <tr>
                <td className={`${tdClass} font-semibold text-fg`} colSpan={3}>
                  Yearly per student
                  <span className="block text-xs font-normal text-muted">Regular fees{oneTime > 0 && `; + ${rupees(oneTime)} one time for new admissions`}</span>
                </td>
                <td className={`${tdClass} text-right text-lg font-semibold tabular-nums text-fg`}>{rupees(yearly)}</td>
                {canManage && <td />}
              </tr>
            </tfoot>
          </Table>
        )}
      </Card>

      {canManage && notCharged.length > 0 && (
        <Card title={`Not charged to ${cls.name}`} description="These fees have no amount for this class. Edit one to give it an amount.">
          <ul className="flex flex-wrap gap-2">
            {notCharged.map((h) => (
              <li key={h.id}>
                <Link href={`/admin/fees/structure/${h.id}?class=${cls.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm text-fg-2 transition hover:border-accent-line hover:text-accent-text">
                  <Plus className="h-3.5 w-3.5" /> {h.name}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
