"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  Eye,
  EyeOff,
  FilePen,
  FileText,
  Presentation,
  Search,
  SearchX,
  Send,
  SlidersHorizontal,
  Undo2,
  UserRoundX,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PaySalaryForm } from "@/components/expenses/pay-salary-form";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  IconTile,
  MenuButton,
  MenuDivider,
  MenuLink,
  Modal,
  MoreMenu,
  SegmentedControl,
  buttonVariants,
  checkboxClass,
  inputClass,
  selectClass,
  useConfirm,
  useToast,
  type BadgeTone,
  type IconTone,
} from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { MODE_LABELS, PAYMENT_MODES, rupees } from "@/lib/fees-shared";
import { dayCount, type PayStatus, type RosterRow } from "@/lib/payroll-shared";
import { payPeople, paySalary, undoSalary } from "@/app/admin/expenses/actions";
import { publishPayslip, publishPayslips, unpublishPayslip } from "@/app/admin/payroll/actions";

const PAGE = 15;
const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

const STATUS: Record<PayStatus, { label: string; tone: BadgeTone }> = {
  unpaid: { label: "Not paid", tone: "amber" },
  draft: { label: "Draft slip", tone: "sky" },
  published: { label: "Published", tone: "green" },
  nosalary: { label: "No salary set", tone: "slate" },
};
const ORDER: Record<PayStatus, number> = { unpaid: 0, draft: 1, published: 2, nosalary: 3 };

type Filter = "all" | PayStatus;
type Group = "all" | "TEACHER" | "STAFF";
type Sort = "status" | "name" | "high" | "low";

/** What the row's pay shows: the amount paid, or what they'd get now (after unpaid days). */
const amountOf = (r: RosterRow) => r.payment?.amount ?? Math.max(0, r.net - r.lopAmount);

/**
 * A month's payroll: everyone with where their salary stands, KPI cards that
 * filter, search, group and sort, row selection for paying or publishing many
 * at once, and each person's next step (pay, publish, view) on their row.
 */
export function PayrollRoster({ rows, month, monthName, today, payKey }: { rows: RosterRow[]; month: string; monthName: string; today: string; payKey?: string }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [group, setGroup] = useState<Group>("all");
  const [sort, setSort] = useState<Sort>("status");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paying, setPaying] = useState<RosterRow | null>(() => rows.find((r) => r.key === payKey && r.status === "unpaid") ?? null);
  const [bulkPay, setBulkPay] = useState<RosterRow[] | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  const inGroup = useMemo(() => rows.filter((r) => group === "all" || r.type === group), [rows, group]);
  const count = (s: PayStatus) => inGroup.filter((r) => r.status === s);
  const sum = (list: RosterRow[]) => list.reduce((n, r) => n + amountOf(r), 0);
  const unpaid = count("unpaid");
  const drafts = count("draft");
  const published = count("published");
  const noSalary = count("nosalary");

  const kpis: { key: Filter; label: string; icon: LucideIcon; tone: IconTone; value: string; detail: string }[] = [
    { key: "all", label: "Everyone", icon: Users, tone: "indigo", value: String(inGroup.length), detail: `Payroll ${rupees(sum(inGroup))}` },
    { key: "unpaid", label: "To pay", icon: Wallet, tone: "amber", value: String(unpaid.length), detail: unpaid.length ? `${rupees(sum(unpaid))} due` : "Everyone is paid" },
    { key: "draft", label: "Drafts to check", icon: FilePen, tone: "sky", value: String(drafts.length), detail: drafts.length ? "Hidden until published" : "Nothing waiting" },
    { key: "published", label: "Published", icon: CircleCheck, tone: "emerald", value: String(published.length), detail: "Employee can see the slip" },
    ...(noSalary.length ? [{ key: "nosalary" as const, label: "No salary set", icon: UserRoundX, tone: "rose" as IconTone, value: String(noSalary.length), detail: "Set basic pay first" }] : []),
  ];

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = inGroup.filter((r) => (filter === "all" || r.status === filter) && words.every((w) => `${r.name} ${r.role}`.toLowerCase().includes(w)));
    const byName = (a: RosterRow, b: RosterRow) => a.name.localeCompare(b.name);
    if (sort === "name") list.sort(byName);
    else if (sort === "high") list.sort((a, b) => amountOf(b) - amountOf(a) || byName(a, b));
    else if (sort === "low") list.sort((a, b) => amountOf(a) - amountOf(b) || byName(a, b));
    else list.sort((a, b) => ORDER[a.status] - ORDER[b.status] || byName(a, b));
    return list;
  }, [inGroup, q, filter, sort]);

  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const current = Math.min(page, pages);
  const visible = shown.slice((current - 1) * PAGE, current * PAGE);
  const reset = () => setPage(1);

  // Selection: only rows with something to do (pay or publish) can be picked.
  const selectable = (r: RosterRow) => r.status === "unpaid" || r.status === "draft";
  const picked = rows.filter((r) => selected.has(r.key));
  const pickedUnpaid = picked.filter((r) => r.status === "unpaid");
  const pickedDrafts = picked.filter((r) => r.status === "draft");
  const pageSelectable = visible.filter(selectable);
  const allOnPage = pageSelectable.length > 0 && pageSelectable.every((r) => selected.has(r.key));
  const toggle = (key: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  const togglePage = (on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      for (const r of pageSelectable) {
        if (on) next.add(r.key);
        else next.delete(r.key);
      }
      return next;
    });

  const run = async (action: Promise<ActionState>) => {
    const res = await action;
    if (res.error) toast({ title: res.error, tone: "error" });
    else if (res.message) toast({ title: res.message });
    return !res.error;
  };

  const publishPicked = async () => {
    const ok = await confirm({
      title: `Publish ${pickedDrafts.length} slip${pickedDrafts.length === 1 ? "" : "s"}?`,
      message: "Teachers and staff will be able to see, print and download them.",
      confirmLabel: "Publish",
    });
    if (ok && (await run(publishPayslips(pickedDrafts.map((r) => r.payment!.id))))) setSelected(new Set());
  };

  return (
    <div className="space-y-5">
      <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${kpis.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        {kpis.map((k) => {
          const active = filter === k.key;
          return (
            <button
              key={k.key}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setFilter(active && k.key !== "all" ? "all" : k.key);
                reset();
              }}
              className={`group rounded-2xl border bg-surface p-4 text-left shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-lift ${
                active ? "border-accent ring-2 ring-accent/30" : "border-line hover:border-line-strong"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-muted">{k.label}</p>
                <IconTile icon={k.icon} tone={k.tone} size="sm" />
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-fg">{k.value}</p>
              <p className="mt-0.5 truncate text-xs text-muted">{k.detail}</p>
            </button>
          );
        })}
      </div>

      <section className="overflow-clip rounded-2xl border border-line bg-surface shadow-card">
        {/* Toolbar: search, group, sort; replaced by the bulk bar while rows are selected. */}
        {picked.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-accent-line bg-accent-soft px-4 py-3 sm:px-6">
            <span className="mr-auto text-sm font-medium text-accent-text">
              {picked.length} selected
              {picked.length !== pickedUnpaid.length && pickedUnpaid.length > 0 && ` · ${pickedUnpaid.length} to pay`}
              {picked.length !== pickedDrafts.length && pickedDrafts.length > 0 && ` · ${pickedDrafts.length} drafts`}
            </span>
            {pickedUnpaid.length > 0 && (
              <Button size="sm" icon={Banknote} onClick={() => setBulkPay(pickedUnpaid)}>
                Pay {pickedUnpaid.length} · {rupees(sum(pickedUnpaid))}
              </Button>
            )}
            {pickedDrafts.length > 0 && (
              <Button size="sm" variant="secondary" icon={Send} onClick={publishPicked}>
                Publish {pickedDrafts.length}
              </Button>
            )}
            <Button size="sm" variant="ghost" icon={X} onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:px-6 lg:flex-row lg:items-center">
            <div className="relative flex-1 lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  reset();
                }}
                placeholder="Search name or role"
                aria-label="Search people"
                className={`${inputClass} !py-2 !pl-9 !pr-9`}
              />
              {q && (
                <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-subtle hover:text-fg-2">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <SegmentedControl
              label="Staff group"
              size="sm"
              value={group}
              onChange={(v) => {
                setGroup(v);
                reset();
              }}
              options={[
                { value: "all", label: "Everyone" },
                { value: "TEACHER", label: "Teaching", icon: Presentation },
                { value: "STAFF", label: "Non-teaching", icon: Users },
              ]}
            />
            <label className="flex items-center gap-2 text-sm text-muted lg:ml-auto">
              Sort
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={`${selectClass} !w-44 !py-2`}>
                <option value="status">Next step first</option>
                <option value="name">Name</option>
                <option value="high">Pay: high to low</option>
                <option value="low">Pay: low to high</option>
              </select>
            </label>
          </div>
        )}

        {shown.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={rows.length ? "Nobody matches" : "No teachers or staff yet"}
            description={rows.length ? "Try another search, group or card." : "Add teachers and staff to run payroll."}
          />
        ) : (
          <>
            {/* Column heads (wide screens). */}
            <div className="hidden items-center gap-4 border-b border-line bg-surface-2/70 px-6 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted lg:grid lg:grid-cols-[1.25rem_minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <input
                type="checkbox"
                checked={allOnPage}
                disabled={!pageSelectable.length}
                onChange={(e) => togglePage(e.target.checked)}
                aria-label="Select everyone on this page"
                className={checkboxClass}
              />
              <span>Person</span>
              <span className="text-right">Net pay</span>
              <span>Paid</span>
              <span>Status</span>
              <span className="w-40 text-right">Actions</span>
            </div>
            <ul className="divide-y divide-line">
              {visible.map((r) => (
                <Row
                  key={r.key}
                  r={r}
                  checked={selected.has(r.key)}
                  onCheck={selectable(r) ? (on) => toggle(r.key, on) : undefined}
                  month={month}
                  monthName={monthName}
                  onPay={() => setPaying(r)}
                  run={run}
                />
              ))}
            </ul>
          </>
        )}

        {pages > 1 && (
          <nav aria-label="Pages" className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-muted sm:px-6">
            <span className="tabular-nums">
              {(current - 1) * PAGE + 1}–{Math.min(current * PAGE, shown.length)} of {shown.length} people
            </span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setPage(current - 1)} disabled={current === 1} aria-label="Previous page" className={pagerBtn}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-14 text-center tabular-nums">
                {current} / {pages}
              </span>
              <button type="button" onClick={() => setPage(current + 1)} disabled={current === pages} aria-label="Next page" className={pagerBtn}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </nav>
        )}
      </section>

      <Modal
        open={!!paying}
        onClose={() => setPaying(null)}
        size="md"
        title={paying ? `Pay ${paying.name}` : undefined}
        description={paying ? `${paying.role} · ${monthName}` : undefined}
      >
        {paying && (
          <div className="space-y-4 p-6">
            <dl className="grid grid-cols-3 gap-3 rounded-xl bg-surface-2 p-4 text-center">
              <div>
                <dt className="text-xs text-muted">Gross</dt>
                <dd className="font-semibold tabular-nums text-fg">{rupees(paying.gross)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Deductions</dt>
                <dd className="font-semibold tabular-nums text-danger">{rupees(paying.gross - paying.net)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Net</dt>
                <dd className="font-semibold tabular-nums text-success">{rupees(paying.net)}</dd>
              </div>
            </dl>
            {paying.lopDays > 0 && (
              <p className="rounded-xl bg-danger-soft/60 px-3 py-2 text-xs text-fg-2">
                <strong className="text-danger">{dayCount(paying.lopDays)} unpaid</strong> ({paying.lopWhy}) = {rupees(paying.lopAmount)} loss of pay.
                {paying.unmarked > 0 && " If they were present on the unmarked days, mark attendance before paying."}
              </p>
            )}
            <p className="text-xs text-muted">
              Paying makes a draft slip you can check and edit before publishing.{" "}
              <Link href={`/admin/payroll/preview?person=${encodeURIComponent(paying.key)}&month=${month}`} className="font-medium text-accent-text hover:underline">
                Preview the slip
              </Link>
            </p>
            <PaySalaryForm
              action={paySalary.bind(null, paying.key, month)}
              net={paying.net}
              lopDays={paying.lopDays}
              lopAmount={paying.lopAmount}
              today={today}
              onSuccess={() => setPaying(null)}
            />
          </div>
        )}
      </Modal>

      <Modal
        open={!!bulkPay}
        onClose={() => setBulkPay(null)}
        size="md"
        title={bulkPay ? `Pay ${bulkPay.length} ${bulkPay.length === 1 ? "person" : "people"}` : undefined}
        description={monthName}
      >
        {bulkPay && <BulkPayForm people={bulkPay} month={month} today={today} onDone={() => (setBulkPay(null), setSelected(new Set()))} />}
      </Modal>
    </div>
  );
}

/** One person's row: who, pay, payment, status, and their next step. */
function Row({
  r,
  checked,
  onCheck,
  month,
  monthName,
  onPay,
  run,
}: {
  r: RosterRow;
  checked: boolean;
  onCheck?: (on: boolean) => void;
  month: string;
  monthName: string;
  onPay: () => void;
  run: (a: Promise<ActionState>) => Promise<boolean>;
}) {
  const confirm = useConfirm();
  const first = r.name.split(" ")[0];
  const preview = `/admin/payroll/preview?person=${encodeURIComponent(r.key)}&month=${month}`;
  const slip = r.payment && `/admin/payslips/${r.payment.id}`;
  const structure = r.profileHref && `${r.profileHref}&sv=structure`;

  const primary =
    r.status === "unpaid" ? (
      <Button size="sm" icon={Banknote} onClick={onPay}>
        Pay
      </Button>
    ) : r.status === "draft" ? (
      <ActionForm action={publishPayslip.bind(null, r.payment!.id)} compact className="flex items-center">
        <SubmitButton size="sm" variant="secondary" icon={<Send className="h-3.5 w-3.5" />}>
          Publish
        </SubmitButton>
      </ActionForm>
    ) : r.status === "published" ? (
      <Link href={slip!} className={`${buttonVariants.ghost} h-8 px-2.5 text-xs`}>
        <FileText className="h-3.5 w-3.5" /> View slip
      </Link>
    ) : structure ? (
      <Link href={structure} className={`${buttonVariants.secondary} h-8 px-2.5 text-xs`}>
        <SlidersHorizontal className="h-3.5 w-3.5" /> Set salary
      </Link>
    ) : null;

  return (
    <li
      className={`grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 transition sm:px-6 lg:grid-cols-[1.25rem_minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:gap-4 ${
        checked ? "bg-accent-soft/50" : "hover:bg-surface-2/60"
      }`}
    >
      {onCheck ? (
        <input type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} aria-label={`Select ${r.name}`} className={checkboxClass} />
      ) : (
        <span aria-hidden />
      )}

      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={r.name} size="md" />
        <div className="min-w-0">
          {r.profileHref ? (
            <Link href={r.profileHref} className="block truncate font-medium text-fg transition hover:text-accent-text">
              {r.name}
            </Link>
          ) : (
            <span className="block truncate font-medium text-fg">{r.name}</span>
          )}
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
            {r.type === "TEACHER" ? <Presentation className="h-3 w-3 shrink-0" /> : <Users className="h-3 w-3 shrink-0" />}
            <span className="truncate">{r.role}</span>
            {r.items > 0 && <Badge tone="indigo">+{r.items} one-time</Badge>}
            {!r.payment && r.unmarked > 0 && (
              <span title="Working days with no attendance mark: counted as absent. Mark attendance first if they were present.">
                <Badge tone="amber">{r.unmarked} not marked</Badge>
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Net pay (with gross and unpaid days underneath). */}
      <div className="col-start-2 text-left tabular-nums lg:col-start-auto lg:text-right">
        {r.status === "nosalary" ? (
          <span className="text-sm text-subtle">—</span>
        ) : (
          <>
            <span className="font-semibold text-fg">{rupees(amountOf(r))}</span>
            <span className="block text-xs text-muted">
              {r.payment ? `paid · of ${rupees(r.gross)}` : `of ${rupees(r.gross)} gross`}
              {!r.payment && r.lopDays > 0 && (
                <span className="text-danger" title={r.lopWhy}>
                  {" "}
                  · {dayCount(r.lopDays)} unpaid
                </span>
              )}
            </span>
          </>
        )}
      </div>

      <div className="col-start-2 text-xs text-muted lg:col-start-auto">
        {r.payment ? (
          <>
            <span className="block text-sm text-fg-2">{dateFmt.format(new Date(`${r.payment.paidOn}T00:00:00Z`))}</span>
            {MODE_LABELS[r.payment.mode as keyof typeof MODE_LABELS] ?? r.payment.mode}
          </>
        ) : (
          <span className="flex items-center gap-1">
            <CircleDashed className="h-3.5 w-3.5" /> Not yet
          </span>
        )}
      </div>

      <div className="col-start-2 row-start-1 justify-self-end lg:col-start-auto lg:row-start-auto lg:justify-self-start">
        <Badge tone={STATUS[r.status].tone} dot>
          {STATUS[r.status].label}
        </Badge>
      </div>

      <div className="col-span-3 flex items-center justify-end gap-1.5 lg:col-span-1 lg:w-40">
        {primary}
        <MoreMenu label={`More for ${r.name}`}>
          {slip ? (
            <MenuLink href={slip} icon={<FileText />}>
              {r.status === "draft" ? "Open draft slip" : "View slip"}
            </MenuLink>
          ) : (
            r.status === "unpaid" && (
              <MenuLink href={preview} icon={<Eye />}>
                Preview slip
              </MenuLink>
            )
          )}
          {r.status === "draft" && (
            <MenuLink href={`${slip}/edit`} icon={<FilePen />}>
              Edit slip
            </MenuLink>
          )}
          {r.status === "published" && (
            <MenuButton
              icon={<EyeOff />}
              onClick={async () => {
                if (await confirm({ title: `Unpublish ${first}'s slip?`, message: "It goes back to draft, hidden from them, and can be edited.", confirmLabel: "Unpublish" }))
                  await run(unpublishPayslip(r.payment!.id));
              }}
            >
              Unpublish
            </MenuButton>
          )}
          {r.profileHref && (
            <>
              <MenuLink href={`${r.profileHref}&month=${month}`} icon={<Wallet />}>
                {first}&apos;s {monthName} pay
              </MenuLink>
              <MenuLink href={structure!} icon={<SlidersHorizontal />}>
                Salary structure
              </MenuLink>
              <MenuLink href={`${r.profileHref}&sv=history`} icon={<FileText />}>
                Payslip history
              </MenuLink>
            </>
          )}
          {r.payment && (
            <>
              <MenuDivider />
              <MenuButton
                danger
                icon={<Undo2 />}
                onClick={async () => {
                  if (
                    await confirm({
                      title: `Remove ${first}'s ${monthName} payment?`,
                      message: "The payment and its slip are deleted. They show as not paid again.",
                      tone: "danger",
                      confirmLabel: "Remove payment",
                    })
                  )
                    await run(undoSalary(r.payment!.id));
                }}
              >
                Undo payment
              </MenuButton>
            </>
          )}
        </MoreMenu>
      </div>
    </li>
  );
}

/** Pays several people at once, on one date and mode; unpaid days come off only when ticked. */
function BulkPayForm({ people, month, today, onDone }: { people: RosterRow[]; month: string; today: string; onDone: () => void }) {
  const [deduct, setDeduct] = useState(true);
  const withLop = people.filter((p) => p.lopAmount > 0);
  const total = people.reduce((n, p) => n + p.net - (deduct ? p.lopAmount : 0), 0);
  return (
    <ActionForm action={payPeople.bind(null, month, people.map((p) => p.key))} keepValues onSuccess={onDone} className="space-y-4 p-6">
      <ul className="max-h-56 divide-y divide-line overflow-y-auto rounded-xl border border-line text-sm">
        {people.map((p) => (
          <li key={p.key} className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="min-w-0 truncate text-fg-2">{p.name}</span>
            <span className="shrink-0 tabular-nums text-fg">{rupees(Math.max(0, p.net - (deduct ? p.lopAmount : 0)))}</span>
          </li>
        ))}
      </ul>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-fg-2">Paid on</span>
          <input type="date" name="paidOn" defaultValue={today} max={today} required className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-fg-2">Mode</span>
          <select name="mode" defaultValue="BANK_TRANSFER" className={selectClass}>
            {PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>
                {MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {withLop.length > 0 && (
        <label className="flex items-start gap-2 rounded-xl bg-danger-soft/60 px-3 py-2 text-sm text-fg-2">
          <input type="checkbox" name="deductLop" checked={deduct} onChange={(e) => setDeduct(e.target.checked)} className={`${checkboxClass} mt-0.5`} />
          <span>
            Deduct unpaid days
            <span className="block text-xs text-muted">
              {withLop.length} of them have unpaid days ({rupees(withLop.reduce((n, p) => n + p.lopAmount, 0))} in all): absent days plus half of each half day, not on approved
              leave.
            </span>
          </span>
        </label>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-sm text-muted">
          Total <span className="font-semibold tabular-nums text-fg">{rupees(total)}</span>
        </p>
        <SubmitButton icon={<Banknote className="h-4 w-4" />}>Pay {people.length}</SubmitButton>
      </div>
      <p className="text-xs text-muted">Each payment makes a draft slip. Check them, then publish so teachers and staff can see them.</p>
    </ActionForm>
  );
}

const pagerBtn =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong bg-surface text-fg-2 shadow-card transition hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40";
