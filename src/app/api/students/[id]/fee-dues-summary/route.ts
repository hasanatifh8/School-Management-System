import { loadStudentAccount, getFeesAccess } from "@/lib/fees";
import { feeSummary, sessionMonths, type DueItem } from "@/lib/fees-shared";
import { fullName } from "@/lib/queries";
import { getViewer } from "@/lib/school";

const FREQUENCY_NAMES = { ONE_TIME: "ONE_TIME", MONTHLY: "MONTHLY", QUARTERLY: "QUARTERLY", HALF_YEARLY: "HALF_YEARLY", YEARLY: "ANNUAL" } as const;

/** One line per fee: instalments of the same fee in a month are added together. */
function byFee(items: DueItem[], withFrequency: boolean) {
  const out = new Map<string, { fee_name: string; frequency?: string; amount: number }>();
  for (const d of items) {
    const row = out.get(d.headId) ?? { fee_name: d.headName, ...(withFrequency && { frequency: FREQUENCY_NAMES[d.frequency] }), amount: 0 };
    row.amount += d.balance;
    out.set(d.headId, row);
  }
  return [...out.values()];
}

/**
 * GET /api/students/:id/fee-dues-summary?target_month=2026-10[&waive_late_fee=true]
 *
 * A student's dues for a billing month, worked out from the fee structure and
 * the receipts so far: that month's demand, earlier unpaid months with their
 * late fees, and the total. School admins and cashiers only.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/students/[id]/fee-dues-summary">) {
  if (!(await getViewer())) return Response.json({ error: "Sign in as a school admin or cashier." }, { status: 401 });
  const { id } = await ctx.params;
  const { school } = await getFeesAccess();
  const account = await loadStudentAccount(school.id, id);
  if (!account) return Response.json({ error: "Student not found." }, { status: 404 });
  const { student, session, dues, today } = account;

  const url = new URL(request.url);
  const months = sessionMonths(session.startDate.toISOString().slice(0, 10));
  const requested = url.searchParams.get("target_month");
  if (requested && !months.includes(requested)) {
    return Response.json({ error: `target_month must be a month of session ${session.name} (${months[0]} to ${months[11]}).` }, { status: 400 });
  }
  const target = requested ?? (months.includes(today.slice(0, 7)) ? today.slice(0, 7) : months[0]);
  const waive = url.searchParams.get("waive_late_fee") === "true";

  const s = feeSummary(dues, target);
  const late = waive ? 0 : s.lateFeeTotal;
  const outstanding = s.currentTotal + s.previousTotal + late;

  return Response.json(
    {
      student: {
        id: student.id,
        code: student.studentCode,
        name: fullName(student),
        class: student.section ? `${student.section.class.name}-${student.section.name}` : null,
        session: session.name,
      },
      billing_period: s.label,
      summary: {
        current_month_total: s.currentTotal,
        previous_dues_total: s.previousTotal,
        late_fee_total: late,
        total_outstanding: outstanding,
        suggested_discount: 0,
        net_payable: outstanding,
      },
      current_breakdown: byFee(s.current, true),
      previous_dues_breakdown: s.previous.map((g) => ({
        month: g.label,
        amount: g.amount,
        late_fee: waive ? 0 : g.lateFee,
        subtotal: g.amount + (waive ? 0 : g.lateFee),
        items: byFee(g.items, false),
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
