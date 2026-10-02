"use client";

import { useMemo, useState } from "react";
import { Search, Send, X } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { checkboxClass, inputClass, selectClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import {
  APPLICANT_LABELS,
  CATEGORY_LABELS,
  LEAVE_CATEGORIES,
  MAX_LEAVE_DAYS,
  leaveDays,
  type LeaveApplicantKey,
  type LeavePerson,
} from "@/lib/leave-shared";

/**
 * A leave application: who it's for, the dates, the reason. `self` is the
 * signed-in teacher's own option ("Myself"), which needs no person picked.
 */
export function LeaveForm({
  action,
  people,
  self,
  canApproveNow,
  today,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  people: LeavePerson[];
  self?: LeaveApplicantKey;
  canApproveNow: boolean;
  today: string;
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
  const days = from && to && to >= from ? leaveDays(from, to) : 0;

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
            <select name="category" required defaultValue="" className={selectClass}>
              <option value="" disabled>
                Choose a reason
              </option>
              {LEAVE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Description" name="description" errors={state.fieldErrors} hint="Optional. Details for whoever approves it.">
            <textarea name="description" rows={3} maxLength={500} className={inputClass} />
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
