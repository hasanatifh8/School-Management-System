import Link from "next/link";
import { Plus } from "lucide-react";
import { LeaveList } from "@/components/leave/leave-list";
import { Pagination } from "@/components/pagination";
import { ButtonLink, Card, PageHeader, StatusTab } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { leaveFilters, listLeave, type LeaveActor, type LeaveView } from "@/lib/leave";
import { STATUS_LABELS, type LeaveStatusKey } from "@/lib/leave-shared";

type Params = Record<string, string | string[] | undefined>;

/** The leave list with status tabs and applicant filters (admin and teacher portals). */
export async function LeavePageContent({
  actor,
  params,
  base,
  whoOptions,
  subtitle,
  personHref,
  decide,
  withdraw,
}: {
  actor: LeaveActor;
  params: Params;
  base: string;
  whoOptions: { value: string; label: string }[];
  subtitle: string;
  personHref: (r: LeaveView) => string | null;
  decide: (id: string) => (approve: boolean, state: ActionState, formData: FormData) => Promise<ActionState>;
  withdraw: (id: string) => () => Promise<ActionState>;
}) {
  const filters = leaveFilters(params);
  const { rows, paging, byStatus } = await listLeave(actor, filters, params);
  const statusKey = filters.status?.toLowerCase() ?? "all";
  const who = typeof params.who === "string" ? params.who : "";
  const href = (status: string, w: string) => {
    const q = new URLSearchParams();
    if (status !== "pending") q.set("status", status);
    if (w) q.set("who", w);
    return `${base}${q.size ? `?${q}` : ""}`;
  };
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        title="Leave"
        subtitle={subtitle}
        action={
          <ButtonLink href={`${base}/new`} icon={Plus}>
            New leave request
          </ButtonLink>
        }
      />
      <Card padded={false}>
        <div className="flex gap-6 overflow-x-auto border-b border-line px-4 pt-4 text-sm font-medium sm:px-6">
          {(["PENDING", "APPROVED", "REJECTED"] as LeaveStatusKey[]).map((s) => (
            <StatusTab key={s} href={href(s.toLowerCase(), who)} active={filters.status === s} label={STATUS_LABELS[s]} count={byStatus[s]} />
          ))}
          <StatusTab href={href("all", who)} active={!filters.status} label="All" count={total} />
        </div>
        <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-3 sm:px-6" role="group" aria-label="Filter by applicant">
          {[{ value: "", label: "Everyone" }, ...whoOptions].map((o) => (
            <Link
              key={o.value}
              href={href(statusKey, o.value)}
              aria-current={who === o.value ? "true" : undefined}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${who === o.value ? "bg-fg text-canvas" : "bg-surface-3 text-fg-2 hover:bg-line-strong"}`}
            >
              {o.label}
            </Link>
          ))}
        </div>
        <LeaveList
          rows={rows}
          personHref={personHref}
          decide={decide}
          withdraw={withdraw}
          emptyText={filters.status === "PENDING" ? "No requests waiting for a decision" : "No leave requests here"}
        />
        <Pagination paging={paging} noun="requests" />
      </Card>
    </>
  );
}
