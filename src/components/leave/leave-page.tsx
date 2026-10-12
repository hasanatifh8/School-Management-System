import Link from "next/link";
import type { ReactNode } from "react";
import { Plus, UserSearch } from "lucide-react";
import { LeaveBulkBar } from "@/components/leave/leave-bulk";
import { LeaveDrawer } from "@/components/leave/leave-drawer";
import { LeaveList } from "@/components/leave/leave-list";
import { LeaveReview } from "@/components/leave/leave-review";
import { LeaveStatusCards } from "@/components/leave/leave-status-cards";
import { ListToolbar, SearchBox } from "@/components/list-toolbar";
import { Pagination } from "@/components/pagination";
import { Badge, ButtonLink, Card, PageHeader } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { leaveDetail, leaveFilters, listLeave, type LeaveActor, type LeaveTally, type LeaveView } from "@/lib/leave";
import { formatISO } from "@/lib/attendance-shared";
import { APPLICANT_LABELS, CATEGORY_LABELS } from "@/lib/leave-shared";

type Params = Record<string, string | string[] | undefined>;

const longDate = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** The leave list with status tabs, applicant filters and a name search (admin and teacher portals). */
export async function LeavePageContent({
  actor,
  params,
  base,
  whoOptions,
  subtitle,
  personHref,
  decide,
  withdraw,
  bulkApprove,
  headerExtra,
  breadcrumbs,
}: {
  actor: LeaveActor;
  params: Params;
  base: string;
  whoOptions: { value: string; label: string }[];
  subtitle: string;
  personHref: (r: LeaveView) => string | null;
  decide: (id: string) => (approve: boolean, state: ActionState, formData: FormData) => Promise<ActionState>;
  withdraw: (id: string) => () => Promise<ActionState>;
  /** Approve several selected requests at once (adds checkboxes). */
  bulkApprove?: (ids: string[]) => Promise<ActionState>;
  /** More header buttons, before "New leave request". */
  headerExtra?: ReactNode;
  breadcrumbs?: ReactNode;
}) {
  const filters = leaveFilters(params);
  const { rows, paging, byStatus, urgent, people } = await listLeave(actor, filters, params);
  const openId = typeof params.open === "string" ? params.open : null;
  const detail = openId ? await leaveDetail(actor, openId) : null;
  const statusKey = filters.status?.toLowerCase() ?? "all";
  const who = typeof params.who === "string" ? params.who : "";
  const href = (status: string, w: string) => {
    const q = new URLSearchParams();
    // A search shows every status by default, so its status is always spelled out.
    if (status !== "pending" || filters.q) q.set("status", status);
    if (w) q.set("who", w);
    if (filters.q) q.set("q", filters.q);
    if (filters.on) q.set("on", filters.on);
    return `${base}${q.size ? `?${q}` : ""}`;
  };
  // The current list URL (status, applicant, page) with or without an open request.
  const listHref = (open: string | null) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (typeof v === "string" && k !== "open") q.set(k, v);
    if (open) q.set("open", open);
    return `${base}${q.size ? `?${q}` : ""}`;
  };

  return (
    <>
      {breadcrumbs}
      <PageHeader
        title="Leave"
        subtitle={subtitle}
        action={
          <>
            {headerExtra}
            <ButtonLink href={`${base}/new`} icon={Plus}>
              New leave request
            </ButtonLink>
          </>
        }
      />
      <LeaveStatusCards byStatus={byStatus} urgent={urgent} active={filters.status} href={(s) => href(s, who)} />
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line px-4 py-3 sm:px-6">
          <div className="flex flex-1 flex-wrap gap-1.5" role="group" aria-label="Filter by applicant">
            {[{ value: "", label: "Everyone" }, ...whoOptions].map((o) => (
              <Link
                key={o.value}
                href={href(statusKey, o.value)}
                scroll={false}
                aria-current={who === o.value ? "true" : undefined}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${who === o.value ? "bg-fg text-canvas" : "bg-surface-3 text-fg-2 hover:bg-line-strong"}`}
              >
                {o.label}
              </Link>
            ))}
          </div>
          <ListToolbar>
            <SearchBox placeholder="Search a name or ID…" />
          </ListToolbar>
        </div>
        {filters.on && (
          <p className="flex flex-wrap items-center gap-x-2 border-b border-line bg-surface-2/60 px-4 py-2.5 text-sm text-fg-2 sm:px-6">
            Leave covering <strong className="font-semibold text-fg">{formatISO(filters.on, longDate)}</strong>
            <Link href={base} className="font-medium text-accent-text hover:underline">
              Show all leave
            </Link>
          </p>
        )}
        {filters.q && <LeaveTallyList people={people} personHref={personHref} q={filters.q} />}
        {bulkApprove && <LeaveBulkBar id="leave-bulk" approve={bulkApprove} />}
        <LeaveList
          rows={rows}
          personHref={personHref}
          decide={decide}
          withdraw={withdraw}
          openHref={(id) => listHref(id)}
          bulkForm={bulkApprove ? "leave-bulk" : undefined}
          emptyText={filters.q ? `No leave requests for “${filters.q}”` : filters.status === "PENDING" ? "No requests waiting for a decision" : "No leave requests here"}
        />
        <Pagination paging={paging} noun="requests" />
      </Card>
      {detail && (
        <LeaveDrawer
          key={detail.id}
          title={`${CATEGORY_LABELS[detail.category]} leave`}
          description={`${APPLICANT_LABELS[detail.applicant]} · ${detail.person.name}`}
          closeHref={listHref(null)}
        >
          <LeaveReview
            r={detail}
            personHref={personHref(detail)}
            attachmentHref={`/api/leave/${detail.id}/attachment`}
            decide={decide(detail.id)}
            withdraw={withdraw(detail.id)}
          />
        </LeaveDrawer>
      )}
    </>
  );
}

/** For a search: who matched, how many times each asked for leave, and the days approved. */
function LeaveTallyList({ people, personHref, q }: { people: LeaveTally[]; personHref: (r: LeaveView) => string | null; q: string }) {
  if (!people.length) return null;
  return (
    <div className="border-b border-line bg-surface-2/60 px-4 py-3 sm:px-6">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted">
        <UserSearch className="h-3.5 w-3.5" aria-hidden />
        {people.length === 1 ? "1 person" : `${people.length} people`} matching “{q}”
      </p>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {people.slice(0, 12).map((p) => {
          // personHref takes a request; it only reads who the request is for.
          const href = personHref({ applicant: p.applicant, person: p } as unknown as LeaveView);
          return (
            <li key={p.key} className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                {href ? (
                  <Link href={href} className="truncate font-medium text-fg hover:text-accent-text">
                    {p.name}
                  </Link>
                ) : (
                  <span className="truncate font-medium text-fg">{p.name}</span>
                )}
                <span className="shrink-0 text-xs text-muted">{APPLICANT_LABELS[p.applicant]}</span>
              </div>
              {p.sub && <p className="truncate text-xs text-muted">{p.sub}</p>}
              <p className="mt-1.5 text-sm text-fg-2">
                <strong className="font-semibold text-fg">{p.requests}</strong> {p.requests === 1 ? "leave request" : "leave requests"} ·{" "}
                <strong className="font-semibold text-fg">{p.approvedDays}</strong> {p.approvedDays === 1 ? "day" : "days"} approved
              </p>
              <p className="mt-1 flex flex-wrap gap-1">
                {p.approved > 0 && <Badge tone="green">{p.approved} approved</Badge>}
                {p.pending > 0 && <Badge tone="amber">{p.pending} pending</Badge>}
                {p.rejected > 0 && <Badge tone="red">{p.rejected} rejected</Badge>}
              </p>
            </li>
          );
        })}
      </ul>
      {people.length > 12 && <p className="mt-2 text-xs text-muted">Showing the 12 with the most requests. Type more of the name to narrow it down.</p>}
    </div>
  );
}
