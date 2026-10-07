import { notFound, redirect } from "next/navigation";
import { UserMinus, UserPlus, Users } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { ActionForm, SubmitButton } from "@/components/forms";
import { SelectionControls } from "@/components/selection-controls";
import { Badge, Breadcrumbs, buttonVariants, Card, checkboxClass, selectClass } from "@/components/ui";
import { db } from "@/lib/db";
import { getFeesAccess, loadFeeHeads } from "@/lib/fees";
import { FREQUENCY_META, rupees } from "@/lib/fees-shared";
import { fullName, sectionLabel } from "@/lib/queries";
import { addOptionalFeeStudents, removeOptionalFeeStudents } from "../../../actions";

const LIMIT = 300;

/** Who pays an opt-in fee such as sports or transport: tick students to add or remove them in bulk. */
export default async function OptionalFeeStudentsPage({ params, searchParams }: PageProps<"/admin/fees/structure/[id]/students">) {
  const { id } = await params;
  const sp = await searchParams;
  const { school, session } = await getFeesAccess();
  const [heads, classes] = await Promise.all([
    loadFeeHeads(session.id),
    db.schoolClass.findMany({ where: { schoolId: school.id }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  const head = heads.find((h) => h.id === id && h.optional);
  if (!head) notFound();
  // Who pays the transport fee follows who is on a bus.
  if (head.transport) redirect("/admin/transport");

  // Only classes this fee has an amount for.
  const charged = classes.filter((c) => head.amounts[c.id] > 0);
  const classId = typeof sp.classId === "string" && charged.some((c) => c.id === sp.classId) ? sp.classId : "";
  const inClasses: Prisma.StudentWhereInput = {
    schoolId: school.id,
    status: "ACTIVE",
    section: { classId: classId ? classId : { in: charged.map((c) => c.id) } },
  };
  const order: Prisma.StudentOrderByWithRelationInput[] = [
    { section: { class: { sortOrder: "asc" } } },
    { section: { name: "asc" } },
    { rollNumber: { sort: "asc", nulls: "last" } },
    { firstName: "asc" },
  ];
  const include = { section: { include: { class: true } } } as const;

  const [members, others, totalMembers, paidItems] = await Promise.all([
    db.student.findMany({ where: { ...inClasses, feeHeads: { some: { headId: head.id } } }, orderBy: order, include, take: LIMIT }),
    db.student.findMany({ where: { ...inClasses, feeHeads: { none: { headId: head.id } } }, orderBy: order, include, take: LIMIT }),
    db.studentFeeHead.count({ where: { headId: head.id, student: { status: "ACTIVE" } } }),
    db.feeReceiptItem.findMany({
      where: { headId: head.id, receipt: { sessionId: session.id, cancelledAt: null } },
      select: { receipt: { select: { studentId: true } } },
    }),
  ]);
  const hasPaid = new Set(paidItems.map((p) => p.receipt.studentId));
  const often = FREQUENCY_META[head.frequency].short;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <Breadcrumbs items={[{ label: "Fee structure", href: "/admin/fees/structure" }, { label: head.name }]} />
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-h2 font-semibold text-fg">{head.name}</h2>
            <p className="mt-1 text-sm text-muted">
              Opt-in fee, charged only to the students added here. {totalMembers} student(s) pay it this session.
            </p>
          </div>
          <form className="flex gap-2">
            <select name="classId" defaultValue={classId} aria-label="Class" className={selectClass}>
              <option value="">All classes</option>
              {charged.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {rupees(head.amounts[c.id])} {often}
                </option>
              ))}
            </select>
            <button className={buttonVariants.secondary}>Show</button>
          </form>
        </div>
        {charged.length < classes.length && (
          <p className="mt-3 text-xs text-muted">
            Only classes with an amount for {head.name} are listed. Set amounts for other classes by editing the fee.
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Not paying" icon={UserPlus} description={`Tick students to start charging ${head.name}.`}>
          <ActionForm action={addOptionalFeeStudents.bind(null, head.id)} className="space-y-3">
            {others.length === 0 ? (
              <p className="rounded-lg bg-surface-2 p-4 text-center text-sm text-muted">Everyone listed already pays {head.name}.</p>
            ) : (
              <>
                <SelectionControls total={others.length} />
                <StudentChecklist students={others} />
                {others.length === LIMIT && <p className="text-xs text-muted">Showing the first {LIMIT}. Choose a class to see more.</p>}
                <SubmitButton icon={<UserPlus className="h-4 w-4" />}>Add {head.name}</SubmitButton>
              </>
            )}
          </ActionForm>
        </Card>

        <Card title="Paying" icon={Users} description="Students already charged. Anyone who has paid can't be removed.">
          <ActionForm action={removeOptionalFeeStudents.bind(null, head.id)} className="space-y-3">
            {members.length === 0 ? (
              <p className="rounded-lg bg-surface-2 p-4 text-center text-sm text-muted">No one pays {head.name} yet.</p>
            ) : (
              <>
                <SelectionControls total={members.length} />
                <StudentChecklist students={members} paid={hasPaid} />
                {members.length === LIMIT && <p className="text-xs text-muted">Showing the first {LIMIT}. Choose a class to see more.</p>}
                <SubmitButton variant="secondary" icon={<UserMinus className="h-4 w-4" />} confirm={`Stop charging ${head.name} to the ticked students?`}>
                  Remove {head.name}
                </SubmitButton>
              </>
            )}
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}

type ListedStudent = Prisma.StudentGetPayload<{ include: { section: { include: { class: true } } } }>;

function StudentChecklist({ students, paid }: { students: ListedStudent[]; paid?: Set<string | null> }) {
  return (
    <ul className="max-h-[28rem] space-y-1.5 overflow-y-auto pr-1">
      {students.map((s) => (
        <li key={s.id}>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm transition hover:bg-surface-2 has-[:checked]:border-accent-line has-[:checked]:bg-accent-soft">
            <input type="checkbox" name="studentIds" value={s.id} className={checkboxClass} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-fg">{fullName(s)}</span>
              <span className="block truncate text-xs text-muted">
                {s.studentCode} · {s.section ? sectionLabel(s.section) : "No class"}
                {s.rollNumber != null && ` · Roll ${s.rollNumber}`}
              </span>
            </span>
            {paid?.has(s.id) && <Badge tone="green">Paid</Badge>}
          </label>
        </li>
      ))}
    </ul>
  );
}
