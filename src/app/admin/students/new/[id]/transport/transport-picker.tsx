"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Bus, Clock, MapPin, Search, UserRound, Users } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { buttonVariants, checkboxClass, cx, EmptyState, FormActions, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { MonthRange } from "@/components/fees/month-range";
import { rupees } from "@/lib/fees-shared";
import { formatTime } from "@/lib/timetable-shared";

type Route = {
  id: string;
  routeNumber: string;
  name: string | null;
  vehicleNumber: string;
  vehicleType: string | null;
  driverName: string | null;
  driverPhone: string | null;
  stops: string[];
  stopTimes: string[];
  stopFares: number[];
  riders: number;
};

/** One bus at one stop: what the user picks. */
type Option = { route: Route; stop: string; time: string; fare: number };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Type the student's stop; every bus that stops there is listed (several buses
 * can share a stop) and one is chosen.
 */
export function TransportPicker({
  action,
  skipHref,
  routes,
  current,
  months,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  skipHref: string;
  routes: Route[];
  current: { routeId: string; stop: string } | null;
  /** The session's months, for when the transport fee runs. */
  months: string[];
}) {
  const [query, setQuery] = useState(current?.stop ?? "");
  const [chosen, setChosen] = useState(current);

  const allStops = [...new Set(routes.flatMap((r) => r.stops))].sort((a, b) => a.localeCompare(b));
  const q = norm(query);
  const options: Option[] = q
    ? routes.flatMap((route) =>
        route.stops.flatMap((stop, i) => (norm(stop).includes(q) ? [{ route, stop, time: route.stopTimes[i] ?? "", fare: route.stopFares[i] ?? 0 }] : [])),
      )
    : [];
  // Earliest pick-up first, so the list reads like a timetable for the stop.
  options.sort((a, b) => a.stop.localeCompare(b.stop) || (a.time || "99").localeCompare(b.time || "99") || a.route.routeNumber.localeCompare(b.route.routeNumber));
  const isChosen = (o: Option) => chosen?.routeId === o.route.id && chosen.stop === o.stop;

  return (
    <ActionForm action={action} keepValues className="space-y-5 pt-5">
      <input type="hidden" name="routeId" value={chosen?.routeId ?? ""} />
      <input type="hidden" name="stop" value={chosen?.stop ?? ""} />

      <div>
        <label htmlFor="stop-search" className="mb-1.5 block text-sm font-medium text-fg-2">
          Student&apos;s stop
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
          <input
            id="stop-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            autoComplete="off"
            autoFocus
            placeholder="Type the stop name, e.g. Hazratganj"
            className={`${inputClass} pl-9`}
          />
        </div>
        {!q && allStops.length > 0 && (
          <div className="mt-3">
            <p className="mb-2 text-xs text-muted">Or pick a stop:</p>
            <div className="flex flex-wrap gap-1.5">
              {allStops.slice(0, 40).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setQuery(s)}
                  className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-fg-2 transition hover:border-accent-line hover:text-accent-text"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {q &&
        (options.length === 0 ? (
          <EmptyState compact icon={MapPin} title={`No bus stops at “${query.trim()}”`} description="Check the spelling, or skip this step and add transport later from the student's profile." />
        ) : (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-fg-2">
              {options.length === 1 ? "1 bus stops here" : `${options.length} buses stop here`}: choose one
            </legend>
            <ul className="grid gap-3 md:grid-cols-2">
              {options.map((o) => (
                <li key={`${o.route.id}:${o.stop}`}>
                  <label
                    className={cx(
                      "flex h-full cursor-pointer gap-3 rounded-xl border p-4 transition",
                      isChosen(o) ? "border-accent bg-accent-soft/50 ring-4 ring-accent/15" : "border-line hover:border-line-strong",
                    )}
                  >
                    <input
                      type="radio"
                      name="pick"
                      checked={isChosen(o)}
                      onChange={() => setChosen({ routeId: o.route.id, stop: o.stop })}
                      className={`${checkboxClass} mt-1`}
                    />
                    <span className="min-w-0 flex-1 space-y-1.5 text-sm">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="font-semibold text-fg">
                          Route {o.route.routeNumber}
                          {o.route.name && <span className="font-normal text-muted"> · {o.route.name}</span>}
                        </span>
                        {o.fare > 0 && <span className="font-semibold tabular-nums text-fg">{rupees(o.fare)}/month</span>}
                      </span>
                      <span className="flex flex-wrap gap-x-4 gap-y-1 text-muted">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" /> {o.stop}
                        </span>
                        {o.time && (
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" /> Pick-up {formatTime(o.time)}
                          </span>
                        )}
                      </span>
                      <span className="flex flex-wrap gap-x-4 gap-y-1 text-muted">
                        <span className="flex items-center gap-1.5">
                          <Bus className="h-3.5 w-3.5" /> <span className="font-mono">{o.route.vehicleNumber}</span>
                          {o.route.vehicleType && ` · ${o.route.vehicleType}`}
                        </span>
                        {o.route.driverName && (
                          <span className="flex items-center gap-1.5">
                            <UserRound className="h-3.5 w-3.5" /> {o.route.driverName}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" /> {o.route.riders} {o.route.riders === 1 ? "student" : "students"}
                        </span>
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        ))}

      {chosen && (
        <div className="rounded-xl border border-line p-4">
          <p className="mb-1.5 text-sm font-medium text-fg-2">Transport fee months</p>
          <MonthRange months={months} />
          <p className="mt-1.5 text-xs text-muted">The stop&apos;s fare is added to the student&apos;s fees for each of these months.</p>
        </div>
      )}

      <FormActions note="Not using school transport? Skip this step.">
        <Link href={skipHref} className={buttonVariants.secondary}>
          Skip
        </Link>
        <SubmitButton icon={<ArrowRight className="h-4 w-4" />}>Save &amp; next</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}
