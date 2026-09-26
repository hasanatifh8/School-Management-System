import Link from "next/link";
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Rows3, TableProperties, TriangleAlert, UserRoundX, Users } from "lucide-react";
import { RegisterGrid, RegisterLegend, RegisterSummary } from "@/components/attendance/register-grid";
import { Button, Card, StatCard, StatGrid, cx, inputClass } from "@/components/ui";
import { rangeQuery, type RegisterRange } from "@/lib/attendance";
import { MAX_DAILY_DAYS, REGISTER_PERIODS, addDays } from "@/lib/attendance-shared";
import type { Register } from "@/lib/attendance";

type Params = Record<string, string | string[] | undefined>;

/** "Day by day" or "Summary": long ranges can only be summarised. */
export function pickView(params: Params, range: RegisterRange) {
  const days = Math.round((Date.parse(range.to) - Date.parse(range.from)) / 864e5) + 1;
  if (days > MAX_DAILY_DAYS) return "summary" as const;
  return params.view === "summary" ? ("summary" as const) : ("daily" as const);
}

/** Excel download for the same class, range and view as the screen. */
export function registerDownloadHref(sectionId: string, range: RegisterRange) {
  return `/api/attendance/register?section=${sectionId}&${range.query}`;
}

const PERIOD_LABEL = { week: "Week", month: "Month", year: "Session", custom: "Range" } as const;

/**
 * The attendance register body shared by the admin and teacher pages:
 * period filters, headline numbers, and the day-by-day grid or summary.
 */
export function RegisterView({
  basePath,
  register,
  range,
  view,
  min,
  max,
  dayHref,
}: {
  /** The register page's path, e.g. /teacher/attendance/register. */
  basePath: string;
  register: Register;
  range: RegisterRange;
  view: "daily" | "summary";
  /** First and last selectable dates (the session so far). */
  min: string;
  max: string;
  dayHref?: (date: string) => string;
}) {
  const href = (query: string, v = view) => `${basePath}?${query}${v === "summary" ? "&view=summary" : ""}`;
  const canDaily = register.dates.length <= MAX_DAILY_DAYS;
  const periodLabel = PERIOD_LABEL[range.period];

  const current = register.students.filter((s) => !s.moved);
  const percents = current.map((s) => s.periodPercent).filter((p): p is number => p != null);
  const average = percents.length ? Math.round((percents.reduce((a, b) => a + b, 0) / percents.length) * 10) / 10 : null;
  const below = current.filter((s) => s.periodPercent != null && s.periodPercent < 75).length;
  const absences = current.reduce((n, s) => n + s.period.ABSENT, 0);

  const presets = [
    { label: "Last 7 days", from: addDays(max, -6) },
    { label: "Last 30 days", from: addDays(max, -29) },
    { label: "Last 90 days", from: addDays(max, -89) },
  ].map((p) => ({ ...p, from: p.from < min ? min : p.from }));

  return (
    <div className="space-y-6">
      {/* Filters */}
      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <nav aria-label="Register period" className="inline-flex rounded-xl bg-surface-3 p-1">
            {REGISTER_PERIODS.map((p) => {
              const active = p.key === range.period;
              return (
                <Link
                  key={p.key}
                  href={href(rangeQuery({ period: p.key }))}
                  aria-current={active ? "page" : undefined}
                  scroll={false}
                  className={cx(
                    "flex h-8 items-center rounded-lg px-3 text-sm font-medium transition",
                    active ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg",
                  )}
                >
                  {p.label}
                </Link>
              );
            })}
          </nav>

          {range.period !== "custom" && (
            <div className="flex items-center gap-2">
              <NavArrow href={range.prev ? href(range.prev) : null} label={`Previous ${periodLabel.toLowerCase()}`} icon={ChevronLeft} />
              <span className="min-w-40 text-center text-sm font-semibold text-fg">{range.label}</span>
              <NavArrow href={range.next ? href(range.next) : null} label={`Next ${periodLabel.toLowerCase()}`} icon={ChevronRight} />
            </div>
          )}

          {canDaily && (
            <nav aria-label="Register layout" className="inline-flex rounded-xl bg-surface-3 p-1 sm:ml-auto">
              {(
                [
                  { v: "daily", label: "Day by day", icon: TableProperties },
                  { v: "summary", label: "Summary", icon: Rows3 },
                ] as const
              ).map(({ v, label, icon: Icon }) => (
                <Link
                  key={v}
                  href={href(range.query, v)}
                  aria-current={view === v ? "page" : undefined}
                  scroll={false}
                  className={cx(
                    "flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition",
                    view === v ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        {range.period === "custom" && (
          <div className="flex flex-col gap-3 border-t border-line pt-4 lg:flex-row lg:items-end">
            <form action={basePath} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="period" value="custom" />
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
        )}
        {range.period === "custom" && <p className="-mt-1 text-sm text-muted">Showing {range.label}.</p>}
      </section>

      {/* Headline numbers */}
      <StatGrid>
        <StatCard icon={CalendarDays} tone="indigo" label="Working days" value={register.workingDays} detail={`Marked in this ${periodLabel.toLowerCase()}`} />
        <StatCard icon={Users} tone="emerald" label="Class average" value={average == null ? "—" : `${average}%`} detail={`${current.length} students`} />
        <StatCard icon={TriangleAlert} tone="amber" label="Below 75%" value={below} detail={below ? "Need follow-up" : "Everyone is on track"} />
        <StatCard icon={UserRoundX} tone="rose" label="Absences" value={absences} detail={`Total days absent this ${periodLabel.toLowerCase()}`} />
      </StatGrid>

      <Card padded={false}>
        {!canDaily && (
          <p className="border-b border-line bg-surface-2 px-4 py-2 text-xs text-muted sm:px-6">
            Long ranges are shown as a summary. The Excel download also has every day.
          </p>
        )}
        {view === "daily" ? (
          <RegisterGrid register={register} today={max} dayHref={dayHref} periodLabel={periodLabel} />
        ) : (
          <RegisterSummary register={register} periodLabel={periodLabel} />
        )}
        <div className="border-t border-line px-4 py-3 sm:px-6">
          <RegisterLegend />
        </div>
      </Card>
    </div>
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
