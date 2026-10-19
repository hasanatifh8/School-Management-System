import Link from "next/link";
import { Plane, Plus } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, PagedList, tbodyClass, tdClass, thClass, theadClass } from "@/components/ui";
import { formatISO, shortDate } from "@/lib/attendance-shared";
import type { BalanceRow, personLeave } from "@/lib/leave";
import { CATEGORY_LABELS, STATUS_LABELS, STATUS_TONES } from "@/lib/leave-shared";

/**
 * One person's leave on their profile (student, teacher or staff): how many
 * times they asked, the days approved, each request with its decision and,
 * for teachers and staff, this session's balance against the allowances.
 */
export function LeaveHistory({
  leave,
  noun,
  openHref,
  newHref,
  balance,
}: {
  leave: Awaited<ReturnType<typeof personLeave>>;
  /** "student" or "teacher", for the empty state. */
  noun: string;
  /** Opens a request on the Leave page, or null for none. */
  openHref: ((id: string) => string) | null;
  newHref?: string;
  /** This session's allowance, taken and pending working days by type. */
  balance?: { session: string; policy?: { name: string } | null; rows: BalanceRow[] };
}) {
  const newButton = newHref && (
    <ButtonLink href={newHref} icon={Plus} size="sm" variant="secondary">
      New leave request
    </ButtonLink>
  );
  const count = (status: keyof typeof STATUS_LABELS) => leave.filter((r) => r.status === status).length;
  const approvedDays = leave.filter((r) => r.status === "APPROVED").reduce((n, r) => n + r.days, 0);
  const stats = [
    { label: "Leave requests", value: leave.length, tone: "text-fg" },
    { label: "Days approved", value: approvedDays, tone: "text-success" },
    { label: "Pending", value: count("PENDING"), tone: count("PENDING") ? "text-warning" : "text-fg" },
    { label: "Rejected", value: count("REJECTED"), tone: count("REJECTED") ? "text-danger" : "text-fg" },
  ];
  // Only the types with an allowance or some leave this session.
  const balanceRows = balance?.rows.filter((b) => b.allowed != null || b.used || b.pending) ?? [];

  return (
    <div className="space-y-6">
      {balance && balanceRows.length > 0 && (
        <Card
          title={`Leave balance · ${balance.session}`}
          description={`Working days. ${balance.policy ? `Leave group: ${balance.policy.name}.` : "School-wide allowance."} Resets every session.`}
          padded={false}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Type</th>
                  <th className={`${thClass} text-right`}>Allowed</th>
                  <th className={`${thClass} text-right`}>Taken</th>
                  <th className={`${thClass} text-right`}>Pending</th>
                  <th className={`${thClass} text-right`}>Left</th>
                </tr>
              </thead>
              <tbody className={tbodyClass}>
                {balanceRows.map((b) => {
                  const left = b.allowed == null ? null : b.allowed - b.used;
                  return (
                    <tr key={b.category}>
                      <td className={`${tdClass} font-medium text-fg`}>{CATEGORY_LABELS[b.category]}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>
                        {b.allowed ?? "No limit"}
                        {b.extra !== 0 && (
                          <span className="ml-1 text-xs text-accent-text" title="Extra days given for this session">
                            ({b.extra > 0 ? "+" : "−"}
                            {Math.abs(b.extra)})
                          </span>
                        )}
                      </td>
                      <td className={`${tdClass} text-right tabular-nums`}>{b.used}</td>
                      <td className={`${tdClass} text-right tabular-nums ${b.pending ? "text-warning" : ""}`}>{b.pending}</td>
                      <td className={`${tdClass} text-right font-semibold tabular-nums ${left != null && left < 0 ? "text-danger" : left === 0 ? "text-warning" : "text-fg"}`}>{left ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!leave.length ? (
        <EmptyState icon={Plane} title="No leave taken" description={`Leave requests for this ${noun} show here.`} action={newButton} />
      ) : (
        <Card title="Leave" icon={Plane} description={`${leave.length} ${leave.length === 1 ? "request" : "requests"}, ${count("APPROVED")} approved`} action={newButton} padded={false}>
          <dl className="grid grid-cols-2 gap-3 border-b border-line px-4 py-4 sm:grid-cols-4 sm:px-6">
            {stats.map((t) => (
              <div key={t.label}>
                <dt className="text-eyebrow uppercase text-muted">{t.label}</dt>
                <dd className={`mt-0.5 text-lg font-semibold tabular-nums ${t.tone}`}>{t.value}</dd>
              </div>
            ))}
          </dl>
          <PagedList pageSize={10} noun="requests" className="divide-y divide-line">
            {leave.map((r) => {
              const range = r.from === r.to ? formatISO(r.from, shortDate) : `${formatISO(r.from, shortDate)} – ${formatISO(r.to, shortDate)}`;
              return (
                <li key={r.id} className="px-4 py-3.5 sm:px-6">
                  <div className="flex flex-wrap items-center gap-2">
                    {openHref ? (
                      <Link href={openHref(r.id)} className="font-medium text-fg hover:text-accent-text">
                        {range}
                      </Link>
                    ) : (
                      <span className="font-medium text-fg">{range}</span>
                    )}
                    <span className="text-sm text-muted">
                      {r.days} {r.days === 1 ? "day" : "days"}
                    </span>
                    <Badge>{CATEGORY_LABELS[r.category]}</Badge>
                    <span className="ml-auto">
                      <Badge tone={STATUS_TONES[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                    </span>
                  </div>
                  {r.description && <p className="mt-1 line-clamp-2 text-sm text-fg-2">{r.description}</p>}
                  {r.status === "APPROVED" && r.overLimitDates.length > 0 && (
                    <p className="mt-1 text-xs font-medium text-danger">
                      {r.overLimitDates.length} day{r.overLimitDates.length === 1 ? "" : "s"} over the monthly limit: counted absent (unpaid)
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted">
                    Asked by {r.requestedBy}
                    {r.decidedBy && ` · ${STATUS_LABELS[r.status].toLowerCase()} by ${r.decidedBy}`}
                    {r.decisionNote && ` · “${r.decisionNote}”`}
                  </p>
                </li>
              );
            })}
          </PagedList>
        </Card>
      )}
    </div>
  );
}
