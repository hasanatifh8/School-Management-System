import Link from "next/link";
import type { ReactNode } from "react";
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Rows3,
  School,
  SearchX,
  TableProperties,
  TriangleAlert,
  UserRoundX,
  Users,
} from "lucide-react";
import { RegisterGrid, RegisterLegend, RegisterSummary } from "@/components/attendance/register-grid";
import { FilterSelect, ListToolbar, ResetFilters, SearchBox } from "@/components/list-toolbar";
import {
  Button,
  Card,
  Dash,
  EmptyState,
  PagedTable,
  StatCard,
  StatGrid,
  cx,
  inputClass,
  tbodyClass,
  tdClass,
  thClass,
  theadClass,
  trClass,
} from "@/components/ui";
import { REGISTER_BANDS, filterRegisterStudents, rangeQuery, type ClassSummary, type Register, type RegisterRange } from "@/lib/attendance";
import { MAX_DAILY_DAYS, REGISTER_PERIODS, addDays } from "@/lib/attendance-shared";

type Params = Record<string, string | string[] | undefined>;

/** Params that every period / layout link carries over (class and student filters). */
const KEEP = ["section", "q", "band"];

function keepQuery(params: Params) {
  const sp = new URLSearchParams();
  for (const k of KEEP) if (typeof params[k] === "string" && params[k]) sp.set(k, params[k] as string);
  return sp.toString();
}

/** "Day by day" or "Summary": long ranges can only be summarised. */
export function pickView(params: Params, range: RegisterRange) {
  const days = Math.round((Date.parse(range.to) - Date.parse(range.from)) / 864e5) + 1;
  if (days > MAX_DAILY_DAYS) return "summary" as const;
  return params.view === "summary" ? ("summary" as const) : ("daily" as const);
}

/** Excel download for the same class (or "all"), range and student filters as the screen. */
export function registerDownloadHref(sectionId: string, range: RegisterRange, params: Params = {}) {
  const extra = new URLSearchParams();
  for (const k of ["q", "band"]) if (typeof params[k] === "string" && params[k]) extra.set(k, params[k] as string);
  const qs = extra.toString();
  return `/api/attendance/register?section=${sectionId}&${range.query}${qs ? `&${qs}` : ""}`;
}

const PERIOD_LABEL = { week: "Week", month: "Month", year: "Session", custom: "Range" } as const;

const pill = (active: boolean) =>
  cx("flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition", active ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg");

/**
 * Period filters for the register: Week / Month / Session / Custom, previous
 * and next, custom dates with quick ranges, and (optionally) the layout switch.
 */
export function RegisterFilters({
  basePath,
  params,
  range,
  view,
  canDaily,
  min,
  max,
  leading,
}: {
  basePath: string;
  params: Params;
  range: RegisterRange;
  /** Omit to hide the Day by day / Summary switch. */
  view?: "daily" | "summary";
  canDaily?: boolean;
  min: string;
  max: string;
  /** Extra controls before the period switch, e.g. the class picker. */
  leading?: ReactNode;
}) {
  const keep = keepQuery(params);
  const href = (query: string, v = view) => `${basePath}?${[query, keep, v === "summary" ? "view=summary" : ""].filter(Boolean).join("&")}`;
  const periodLabel = PERIOD_LABEL[range.period];
  const presets = [
    { label: "Last 7 days", from: addDays(max, -6) },
    { label: "Last 30 days", from: addDays(max, -29) },
    { label: "Last 90 days", from: addDays(max, -89) },
  ].map((p) => ({ ...p, from: p.from < min ? min : p.from }));

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        {leading}
        <nav aria-label="Register period" className="inline-flex rounded-xl bg-surface-3 p-1">
          {REGISTER_PERIODS.map((p) => (
            <Link key={p.key} href={href(rangeQuery({ period: p.key }))} aria-current={p.key === range.period ? "page" : undefined} scroll={false} className={pill(p.key === range.period)}>
              {p.label}
            </Link>
          ))}
        </nav>

        {range.period !== "custom" && (
          <div className="flex items-center gap-2">
            <NavArrow href={range.prev ? href(range.prev) : null} label={`Previous ${periodLabel.toLowerCase()}`} icon={ChevronLeft} />
            <span className="min-w-40 text-center text-sm font-semibold text-fg">{range.label}</span>
            <NavArrow href={range.next ? href(range.next) : null} label={`Next ${periodLabel.toLowerCase()}`} icon={ChevronRight} />
          </div>
        )}

        {view && canDaily && (
          <nav aria-label="Register layout" className="inline-flex rounded-xl bg-surface-3 p-1 sm:ml-auto">
            <Link href={href(range.query, "daily")} aria-current={view === "daily" ? "page" : undefined} scroll={false} className={pill(view === "daily")}>
              <TableProperties className="h-4 w-4" aria-hidden />
              Day by day
            </Link>
            <Link href={href(range.query, "summary")} aria-current={view === "summary" ? "page" : undefined} scroll={false} className={pill(view === "summary")}>
              <Rows3 className="h-4 w-4" aria-hidden />
              Summary
            </Link>
          </nav>
        )}
      </div>

      {range.period === "custom" && (
        <>
          <div className="flex flex-col gap-3 border-t border-line pt-4 lg:flex-row lg:items-end">
            <form action={basePath} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="period" value="custom" />
              {KEEP.map((k) => typeof params[k] === "string" && params[k] && <input key={k} type="hidden" name={k} value={params[k] as string} />)}
              {view === "summary" && <input type="hidden" name="view" value="summary" />}
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-fg-2">From</span>
                <input type="date" name="from" defaultValue={range.from} min={min} max={max} required className={`${inputClass} !w-44`} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-fg-2">To</span>
                <input type="date" name="to" defaultValue={range.to} min={min} max={max} required className={`${inputClass} !w-44`} />
              </label>
              <Button type="submit" variant="secondary" icon={CalendarRange}>
                Apply
              </Button>
            </form>
            <div className="flex flex-wrap gap-2 lg:ml-auto">
              {presets.map((p) => {
                const active = range.from === p.from && range.to === max;
                return (
                  <Link
                    key={p.label}
                    href={href(rangeQuery({ period: "custom", from: p.from, to: max }))}
                    scroll={false}
                    className={cx(
                      "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                      active ? "border-accent-line bg-accent-soft text-accent-text" : "border-line text-fg-2 hover:border-line-strong hover:text-fg",
                    )}
                  >
                    {p.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <p className="-mt-1 text-sm text-muted">Showing {range.label}.</p>
        </>
      )}
    </section>
  );
}

/**
 * One class's register: period filters, headline numbers, student filters,
 * and the day-by-day grid or summary. Shared by the admin and teacher pages.
 */
export function RegisterView({
  basePath,
  params,
  register,
  range,
  view,
  min,
  max,
  dayHref,
  leading,
}: {
  /** The register page's path, e.g. /teacher/attendance/register. */
  basePath: string;
  params: Params;
  register: Register;
  range: RegisterRange;
  view: "daily" | "summary";
  /** First and last selectable dates (the session so far). */
  min: string;
  max: string;
  dayHref?: (date: string) => string;
  leading?: ReactNode;
}) {
  const canDaily = register.dates.length <= MAX_DAILY_DAYS;
  const periodLabel = PERIOD_LABEL[range.period];
  // Headline numbers are for the whole class; the list below follows the student filters.
  const current = register.students.filter((s) => !s.moved);
  const percents = current.map((s) => s.periodPercent).filter((p): p is number => p != null);
  const average = percents.length ? Math.round((percents.reduce((a, b) => a + b, 0) / percents.length) * 10) / 10 : null;
  const below = current.filter((s) => s.periodPercent != null && s.periodPercent < 75).length;
  const absences = current.reduce((n, s) => n + s.period.ABSENT, 0);
  const shown = { ...register, students: filterRegisterStudents(register.students, params) };
  const filtered = Boolean(params.q || params.band);
  const below75 = new URLSearchParams(range.query);
  if (typeof params.section === "string") below75.set("section", params.section);
  below75.set("band", "below75");
  if (view === "summary") below75.set("view", "summary");
  const belowHref = `${basePath}?${below75}`;

  return (
    <div className="space-y-6">
      <RegisterFilters basePath={basePath} params={params} range={range} view={view} canDaily={canDaily} min={min} max={max} leading={leading} />

      <StatGrid>
        <StatCard icon={CalendarDays} tone="indigo" label="Working days" value={register.workingDays} detail={`Marked in this ${periodLabel.toLowerCase()}`} />
        <StatCard icon={Users} tone="emerald" label="Class average" value={average == null ? "—" : `${average}%`} detail={`${current.length} students`} />
        <StatCard icon={TriangleAlert} tone="amber" label="Below 75%" value={below} detail={below ? "Show them" : "Everyone is on track"} href={below ? belowHref : undefined} />
        <StatCard icon={UserRoundX} tone="rose" label="Absences" value={absences} detail={`Total days absent this ${periodLabel.toLowerCase()}`} />
      </StatGrid>

      <Card padded={false}>
        <div className="border-b border-line px-4 py-4 sm:px-6">
          <ListToolbar>
            <SearchBox placeholder="Student name, ID or roll no.…" />
            <FilterSelect name="band" label="Any attendance" options={REGISTER_BANDS.map((b) => ({ value: b.value, label: b.label }))} />
            <ResetFilters keys={["q", "band"]} />
            {filtered && (
              <span className="text-sm text-muted">
                {shown.students.length} of {register.students.length} students
              </span>
            )}
          </ListToolbar>
        </div>
        {!canDaily && (
          <p className="border-b border-line bg-surface-2 px-4 py-2 text-xs text-muted sm:px-6">
            Long ranges are shown as a summary. The Excel download also has every day.
          </p>
        )}
        {shown.students.length === 0 ? (
          <EmptyState icon={SearchX} title="No students match" description="Try a different name or attendance filter." />
        ) : view === "daily" ? (
          <RegisterGrid register={shown} today={max} dayHref={dayHref} periodLabel={periodLabel} />
        ) : (
          <RegisterSummary register={shown} periodLabel={periodLabel} />
        )}
        <div className="border-t border-line px-4 py-3 sm:px-6">
          <RegisterLegend />
        </div>
      </Card>
    </div>
  );
}

function pctTone(p: number | null) {
  if (p == null) return "text-subtle";
  return p >= 90 ? "text-success" : p >= 75 ? "text-warning" : "text-danger";
}

function barTone(p: number | null) {
  if (p == null) return "bg-line-strong";
  return p >= 90 ? "bg-success-solid" : p >= 75 ? "bg-warning-solid" : "bg-danger-solid";
}

/** School-wide view: one row per class with its attendance for the range. */
export function ClassSummaryTable({
  classes,
  registerHref,
}: {
  classes: ClassSummary[];
  /** Link to one class's register (keeping the period). */
  registerHref: (sectionId: string) => string;
}) {
  if (classes.length === 0) return <EmptyState icon={School} title="No classes match" description="Try a different class filter." />;
  return (
    <PagedTable
      noun="classes"
      pageSize={15}
      theadClassName={theadClass}
      tbodyClassName={tbodyClass}
      head={
        <tr>
          <th className={thClass}>Class</th>
          <th className={`${thClass} hidden text-right sm:table-cell`}>Students</th>
          <th className={`${thClass} hidden text-right md:table-cell`}>Working days</th>
          <th className={`${thClass} min-w-48`}>Average</th>
          <th className={`${thClass} text-right`}>Below 75%</th>
          <th className={`${thClass} hidden text-right lg:table-cell`}>Absences</th>
          <th className={thClass}>
            <span className="sr-only">Open</span>
          </th>
        </tr>
      }
    >
      {classes.map((c) => (
        <tr key={c.id} className={`${trClass} group`}>
          <td className={tdClass}>
            <Link href={registerHref(c.id)} className="rounded font-medium text-fg transition hover:text-accent-text">
              {c.label}
            </Link>
            <p className="text-xs text-muted">{c.classTeacher ?? "No class teacher"}</p>
          </td>
          <td className={`${tdClass} hidden text-right tabular-nums sm:table-cell`}>{c.students}</td>
          <td className={`${tdClass} hidden text-right tabular-nums md:table-cell`}>{c.workingDays || <Dash />}</td>
          <td className={tdClass}>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                <div className={`h-full rounded-full ${barTone(c.average)}`} style={{ width: `${c.average ?? 0}%` }} />
              </div>
              <span className={`w-14 text-right text-sm font-semibold tabular-nums ${pctTone(c.average)}`}>{c.average == null ? "—" : `${c.average}%`}</span>
            </div>
          </td>
          <td className={`${tdClass} text-right tabular-nums ${c.below75 ? "font-semibold text-danger" : "text-subtle"}`}>{c.below75}</td>
          <td className={`${tdClass} hidden text-right tabular-nums lg:table-cell`}>{c.absences}</td>
          <td className={`${tdClass} w-12 text-right`}>
            <Link
              href={registerHref(c.id)}
              aria-label={`Open register for ${c.label}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition group-hover:bg-surface-3 group-hover:text-accent-text"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </td>
        </tr>
      ))}
    </PagedTable>
  );
}

function NavArrow({ href, label, icon: Icon }: { href: string | null; label: string; icon: typeof ChevronLeft }) {
  const cls =
    "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line-strong bg-surface text-fg-2 shadow-card transition hover:bg-surface-2 active:scale-95";
  return href ? (
    <Link href={href} aria-label={label} scroll={false} className={cls}>
      <Icon className="h-4 w-4" />
    </Link>
  ) : (
    <span aria-disabled className={`${cls} pointer-events-none opacity-40`}>
      <Icon className="h-4 w-4" />
    </span>
  );
}
