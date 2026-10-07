"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Save } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { buttonVariants, checkboxClass, inputClass, selectClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { FREQUENCIES, FREQUENCY_META, INSTALMENT_GAP, MONTH_NAMES, dueMonthsOf, rupees, type Frequency } from "@/lib/fees-shared";

/** [5, 8, 11, 2] → "May, Aug, Nov and Feb" */
const listMonths = (months: number[]) => {
  const names = months.map((m) => MONTH_NAMES[m - 1]);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names.join("");
};
import { formatTime } from "@/lib/timetable-shared";

/** A bus route's stops and fares, as set under Transport. */
export type RouteFares = { id: string; routeNumber: string; name: string | null; stops: string[]; stopTimes: string[]; stopFares: number[] };

type Head = { name: string; frequency: Frequency; optional: boolean; transport: boolean; dueDay: number; dueMonth: number | null; lateFee: number; lateFeeMonthly: boolean; amounts: Record<string, number> };

/** Add or edit a fee: name, how often, due day, and the amount for each class. */
export function FeeHeadForm({
  action,
  classes,
  head,
  routes,
  startMonth = 4,
  returnClass,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  classes: { id: string; name: string }[];
  head?: Head;
  /** For the transport fee: the stop fares it charges, from Transport. */
  routes?: RouteFares[];
  /** The session's first month (4 = April), where instalment months start. */
  startMonth?: number;
  /** The class whose fee view opened this form: saving goes back there. */
  returnClass?: string;
}) {
  // The transport fee charges each student's stop fare, monthly: only its name, due day and late fee are set here.
  const transport = head?.transport ?? false;
  const [frequency, setFrequency] = useState<Frequency>(head?.frequency ?? "MONTHLY");
  // Yearly: the month it falls due; quarterly / half-yearly: the first instalment's month (the rest follow).
  const gap = INSTALMENT_GAP[frequency];
  const firstChoice = (f: Frequency) => {
    const saved = head?.dueMonth && head.frequency === f ? head.dueMonth : null;
    const months = Array.from({ length: INSTALMENT_GAP[f] ?? 12 }, (_, i) => ((startMonth - 1 + i) % 12) + 1);
    return saved && months.includes(saved) ? saved : startMonth;
  };
  const [dueMonth, setDueMonth] = useState(() => firstChoice(head?.frequency ?? "MONTHLY"));
  const [fill, setFill] = useState("");
  const amountsRef = useRef<HTMLDivElement>(null);
  const fillAll = () => {
    amountsRef.current?.querySelectorAll<HTMLInputElement>("input[name^='amount:']").forEach((i) => (i.value = fill));
  };

  return (
    <ActionForm action={action} className="space-y-8">
      {(state) => {
        const e = state.fieldErrors;
        return (
          <>
            {returnClass && <input type="hidden" name="returnClass" value={returnClass} />}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fee name" name="name" errors={e} required hint="e.g. Tuition fee, Admission fee, Transport, Annual charges">
                <input name="name" defaultValue={head?.name} maxLength={60} required className={inputClass} />
              </Field>
            </div>

            {transport ? (
              <input type="hidden" name="frequency" value="MONTHLY" />
            ) : (
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-fg-2">How often is it charged?</legend>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {FREQUENCIES.map((f) => (
                    <label
                      key={f}
                      className="flex cursor-pointer gap-3 rounded-xl border border-line p-3 text-sm transition hover:border-accent-line has-[:checked]:border-accent has-[:checked]:bg-accent-soft/60"
                    >
                      <input
                        type="radio"
                        name="frequency"
                        value={f}
                        checked={frequency === f}
                        onChange={() => {
                          setFrequency(f);
                          setDueMonth(firstChoice(f));
                        }}
                        className="mt-0.5 accent-accent"
                      />
                      <span>
                        <span className="block font-medium text-fg">{FREQUENCY_META[f].label}</span>
                        <span className="block text-xs text-muted">{FREQUENCY_META[f].hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              {gap && (
                <Field
                  label={frequency === "YEARLY" ? "Due in" : "First instalment in"}
                  name="dueMonth"
                  errors={e}
                  hint={frequency === "YEARLY" ? undefined : `Then every ${gap} months: ${listMonths(dueMonthsOf(frequency, dueMonth, startMonth))}.`}
                >
                  <select name="dueMonth" value={dueMonth} onChange={(ev) => setDueMonth(Number(ev.target.value))} className={selectClass}>
                    {/* A quarter's instalment falls in that quarter, a half-year's in that half: the choices are its months. */}
                    {Array.from({ length: gap }, (_, i) => ((startMonth - 1 + i) % 12) + 1).map((m) => (
                      <option key={m} value={m}>
                        {MONTH_NAMES[m - 1]}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {frequency !== "ONE_TIME" && (
                <Field label="Due by day of the month" name="dueDay" errors={e} hint="After this day it shows as overdue.">
                  <input type="number" name="dueDay" min={1} max={28} defaultValue={head?.dueDay ?? 10} className={inputClass} />
                </Field>
              )}
              {frequency === "ONE_TIME" && <input type="hidden" name="dueDay" value={head?.dueDay ?? 10} />}
              <Field label="Late fee (₹)" name="lateFee" errors={e} hint="Added when an instalment is paid after its due date. Blank for none.">
                <input name="lateFee" inputMode="numeric" defaultValue={head?.lateFee || ""} placeholder="e.g. 100" className={inputClass} />
              </Field>
            </div>
            <label className="flex max-w-xl items-start gap-3 rounded-xl border border-line p-3 text-sm">
              <input type="checkbox" name="lateFeeMonthly" defaultChecked={head?.lateFeeMonthly ?? true} className={`${checkboxClass} mt-0.5`} />
              <span>
                <span className="block font-medium text-fg">Charge the late fee every month it stays unpaid</span>
                <span className="block text-xs text-muted">
                  E.g. April&apos;s fee paid in July carries April, May and June&apos;s late fees. Untick to charge it once. Fees staff can untick any month when collecting.
                </span>
              </span>
            </label>

            {transport ? (
              <TransportFares routes={routes ?? []} />
            ) : (
              <>
                <label className="flex max-w-xl items-start gap-3 rounded-xl border border-line p-3 text-sm">
                  <input type="checkbox" name="optional" defaultChecked={head?.optional} className={`${checkboxClass} mt-0.5`} />
                  <span>
                    <span className="block font-medium text-fg">Only for students who opt in</span>
                    <span className="block text-xs text-muted">
                      For fees like transport or hostel. You add students to it from their fee page. Leave unticked to charge every student of the class.
                    </span>
                  </span>
                </label>

                <div>
                  <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-fg">Amount per class (₹)</h3>
                      <p className="text-xs text-muted">
                        {frequency === "MONTHLY" ? "Per month." : frequency === "QUARTERLY" ? "Per quarter." : frequency === "HALF_YEARLY" ? "Per half-year." : "The full amount."}{" "}
                        Leave a class blank if this fee doesn&apos;t apply to it.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        value={fill}
                        onChange={(ev) => setFill(ev.target.value.replace(/[^\d]/g, ""))}
                        inputMode="numeric"
                        placeholder="Same for all"
                        aria-label="Amount for every class"
                        className={`${inputClass} !w-36 !py-2`}
                      />
                      <button type="button" onClick={fillAll} className={`${buttonVariants.secondary} !py-2`}>
                        Fill all classes
                      </button>
                    </div>
                  </div>
                  {classes.length === 0 ? (
                    <p className="text-sm text-warning">Create classes first.</p>
                  ) : (
                    <div ref={amountsRef} className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
                      {classes.map((c) => (
                        <Field key={c.id} label={c.name} name={`amount:${c.id}`} errors={e}>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">₹</span>
                            <input
                              name={`amount:${c.id}`}
                              inputMode="numeric"
                              defaultValue={head?.amounts[c.id] ?? ""}
                              className={`${inputClass} pl-7 tabular-nums`}
                            />
                          </div>
                        </Field>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="flex justify-end border-t border-line pt-6">
              <SubmitButton icon={<Save className="h-4 w-4" />}>{head ? "Save changes" : "Add fee"}</SubmitButton>
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}

/** The stop fares the transport fee charges, straight from Transport (edited there). */
function TransportFares({ routes }: { routes: RouteFares[] }) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-fg">Amount: each student&apos;s stop fare (₹ per month)</h3>
          <p className="text-xs text-muted">Students on a bus are charged their stop&apos;s fare every month. Stops without a fare aren&apos;t charged.</p>
        </div>
        <Link href="/admin/transport" className={`${buttonVariants.secondary} !py-2`}>
          Edit fares in Transport
        </Link>
      </div>
      {routes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">No bus routes yet.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {routes.map((r) => (
            <div key={r.id} className="overflow-hidden rounded-xl border border-line">
              <p className="border-b border-line bg-surface-2 px-3 py-2 text-sm font-medium text-fg">
                Route {r.routeNumber}
                {r.name && <span className="font-normal text-muted"> · {r.name}</span>}
              </p>
              <ol className="divide-y divide-line text-sm">
                {r.stops.map((stop, i) => (
                  <li key={stop} className="flex items-center justify-between gap-3 px-3 py-1.5">
                    <span className="min-w-0 truncate text-fg-2">
                      {i + 1}. {stop}
                      {r.stopTimes[i] && <span className="text-muted"> · {formatTime(r.stopTimes[i])}</span>}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums text-fg">{r.stopFares[i] ? rupees(r.stopFares[i]) : <span className="text-subtle">—</span>}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
