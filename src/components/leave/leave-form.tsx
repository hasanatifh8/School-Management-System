"use client";

import { useMemo, useState } from "react";
import { Search, Send, TriangleAlert, X } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { checkboxClass, inputClass, selectClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { MAX_DOCUMENT_LABEL } from "@/lib/document-types";
import {
  APPLICANT_LABELS,
  CATEGORY_LABELS,
  LEAVE_CATEGORIES,
  MAX_LEAVE_DAYS,
  STUDENT_CATEGORIES,
  leaveDays,
  type LeaveCategoryKey,
  type LeaveApplicantKey,
  type LeavePerson,
} from "@/lib/leave-shared";

/**
 * A leave application: who it's for, the dates, the reason. `self` is the
 * signed-in teacher's own option ("Myself"), which needs no person picked.
 * With `balance`, applying for yourself shows the days left of the chosen type
 * and warns (without blocking) when the request asks for more; the admin decides.
 */
export function LeaveForm({
  action,
  people,
  self,
  canApproveNow,
  today,
  balance,
  daysOff = [],
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  people: LeavePerson[];
  self?: LeaveApplicantKey;
  canApproveNow: boolean;
  today: string;
  /** The applicant's own leave left this session, by type (allowed null = no limit). */
  balance?: { category: LeaveCategoryKey; allowed: number | null; used: number; pending: number }[];
  /** Weekly offs and holidays, which leave doesn't count. */
  daysOff?: string[];
}) {
  const kinds = useMemo(() => {
    const present = new Set(people.map((p) => p.applicant));
    return (["STUDENT", "TEACHER", "STAFF"] as const).filter((k) => present.has(k) || k === self);
  }, [people, self]);
  const [applicant, setApplicant] = useState<LeaveApplicantKey>(self ?? kinds[0] ?? "STUDENT");
  const [person, setPerson] = useState<LeavePerson | null>(null);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const isSelf = applicant === self;

  const matches = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return people
      .filter((p) => p.applicant === applicant && words.every((w) => p.name.toLowerCase().includes(w) || p.sub.toLowerCase().includes(w)))
      .slice(0, 8);
  }, [people, applicant, q]);
  const [category, setCategory] = useState<LeaveCategoryKey | "">("");
  const days = from && to && to >= from ? leaveDays(from, to) : 0;
  const categories = applicant === "STUDENT" ? STUDENT_CATEGORIES : LEAVE_CATEGORIES;

  // Working days asked (weekly offs and holidays don't count), against what's left of the chosen type.
  const off = useMemo(() => new Set(daysOff), [daysOff]);
  const working = useMemo(() => {
    if (!days || days > MAX_LEAVE_DAYS) return 0;
    let n = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
      if (!off.has(d)) n++;
    }
    return n;
  }, [from, days, off]);
  const row = isSelf && category ? balance?.find((b) => b.category === category) : undefined;
  const left = row?.allowed != null ? row.allowed - row.used - row.pending : null;

  return (
    <ActionForm action={action} className="space-y-5">
      {(state) => (
        <>
          <input type="hidden" name="applicant" value={applicant} />
          <input type="hidden" name="personId" value={isSelf ? "" : (person?.id ?? "")} />
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-fg-2">Leave for</legend>
            <div className="flex flex-wrap gap-2">
              {kinds.map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={applicant === k}
                  onClick={() => {
                    setApplicant(k);
                    setPerson(null);
                    setQ("");
                    if (k === "STUDENT" && category === "PRIVILEGED") setCategory("");
                  }}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium ring-1 ring-inset transition ${
                    applicant === k ? "bg-accent-soft text-accent-text ring-accent-line" : "bg-surface text-fg-2 ring-line hover:bg-surface-2"
                  }`}
                >
                  {k === self ? "Myself" : `A ${APPLICANT_LABELS[k].toLowerCase()}`}
                </button>
              ))}
            </div>
          </fieldset>

          {!isSelf && (
            <Field label={`${APPLICANT_LABELS[applicant]} (applicant name)`} name="personId" errors={state.fieldErrors} required>
              {person ? (
                <span className="flex items-center justify-between gap-3 rounded-xl border border-accent-line bg-accent-soft px-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-fg">{person.name}</span>
                    <span className="block truncate text-xs text-muted">{person.sub}</span>
                  </span>
                  <button type="button" onClick={() => setPerson(null)} aria-label="Choose someone else" className="rounded p-1 text-subtle hover:text-fg">
                    <X className="h-4 w-4" />
                  </button>
                </span>
              ) : (
                <span className="block">
                  <span className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder={applicant === "STUDENT" ? "Search by name, class or roll no." : "Search by name or ID"}
                      className={`${inputClass} !pl-9`}
                    />
                  </span>
                  <span className="mt-1 block max-h-64 overflow-y-auto rounded-xl border border-line">
                    {matches.length === 0 ? (
                      <span className="block px-3 py-2 text-sm text-muted">No one matches.</span>
                    ) : (
                      matches.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPerson(p)}
                          className="block w-full border-b border-line px-3 py-2 text-left last:border-0 hover:bg-surface-2"
                        >
                          <span className="block text-sm font-medium text-fg">{p.name}</span>
                          <span className="block text-xs text-muted">{p.sub}</span>
                        </button>
                      ))
                    )}
                  </span>
                </span>
              )}
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From" name="fromDate" errors={state.fieldErrors} required>
              <input
                type="date"
                name="fromDate"
                required
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  if (to < e.target.value) setTo(e.target.value);
                }}
                className={inputClass}
              />
            </Field>
            <Field
              label="To"
              name="toDate"
              errors={state.fieldErrors}
              required
              hint={days ? `${days} day${days === 1 ? "" : "s"}${days > MAX_LEAVE_DAYS ? ` (at most ${MAX_LEAVE_DAYS})` : ""}` : undefined}
            >
              <input type="date" name="toDate" required value={to} min={from} onChange={(e) => setTo(e.target.value)} className={inputClass} />
            </Field>
          </div>

          <Field label="Reason" name="category" errors={state.fieldErrors} required>
            <select name="category" required value={category} onChange={(e) => setCategory(e.target.value as LeaveCategoryKey)} className={selectClass}>
              <option value="" disabled>
                Choose a reason
              </option>
              {categories.map((c) => {
                const b = isSelf ? balance?.find((x) => x.category === c) : undefined;
                const l = b?.allowed != null ? Math.max(0, b.allowed - b.used - b.pending) : null;
                return (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                    {l != null ? ` · ${l} day${l === 1 ? "" : "s"} left` : ""}
                  </option>
                );
              })}
            </select>
          </Field>

          {row && left != null && working > 0 && (
            <p
              role="status"
              className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ring-1 ring-inset ${
                working > left ? "bg-warning-soft text-warning ring-warning-line" : "bg-surface-2 text-fg-2 ring-line"
              }`}
            >
              {working > left && <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>
                {working > left ? (
                  <>
                    <strong>
                      This asks for {working} working day{working === 1 ? "" : "s"} but you have {Math.max(0, left)} {CATEGORY_LABELS[row.category].toLowerCase()} left.
                    </strong>{" "}
                    You can still apply; the school decides, and days over your balance may be unpaid.
                  </>
                ) : (
                  <>
                    {working} working day{working === 1 ? "" : "s"}. After this you&apos;ll have {left - working} {CATEGORY_LABELS[row.category].toLowerCase()} day
                    {left - working === 1 ? "" : "s"} left.
                  </>
                )}
                {row.pending > 0 && ` (${row.pending} day${row.pending === 1 ? "" : "s"} already waiting for approval are counted.)`}
              </span>
            </p>
          )}

          <Field label="Description" name="description" errors={state.fieldErrors} hint="Optional. Details for whoever approves it.">
            <textarea name="description" rows={3} maxLength={500} className={inputClass} />
          </Field>

          <Field
            label="Supporting document"
            name="attachment"
            errors={state.fieldErrors}
            hint={`Optional. A medical certificate or letter: PDF, JPG, PNG or WebP up to ${MAX_DOCUMENT_LABEL}.`}
          >
            <input type="file" name="attachment" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" className={inputClass} />
          </Field>

          {canApproveNow && (
            <label className="flex items-center gap-2 text-sm text-fg-2">
              <input type="checkbox" name="approveNow" className={checkboxClass} />
              Approve it now (for example, an application already signed off on paper)
            </label>
          )}

          <SubmitButton icon={<Send className="h-4 w-4" />}>{isSelf ? "Apply for leave" : "Submit leave request"}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
