"use client";

import { useMemo, useState } from "react";
import { Save, Search } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Badge, checkboxClass, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { CATEGORY_LABELS, LEAVE_CATEGORIES, type LeaveCategoryKey } from "@/lib/leave-shared";

export type Member = { id: string; kind: "teacher" | "staff"; name: string; sub: string; group: string | null };

/**
 * A leave group: its name, days per leave type (blank = no limit) and who is
 * in it. Ticking someone already in another group moves them here.
 */
export function LeaveGroupForm({
  action,
  name,
  days,
  members,
  selected,
  groupName,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  name: string;
  days: Partial<Record<LeaveCategoryKey, number>>;
  members: Member[];
  /** Keys "teacher:<id>" / "staff:<id>" of the current members. */
  selected: string[];
  /** This group's saved name, to tell its members from other groups'. */
  groupName: string | null;
}) {
  const [picked, setPicked] = useState(() => new Set(selected));
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"all" | "teacher" | "staff" | "in">("all");
  const key = (m: Member) => `${m.kind}:${m.id}`;

  const visible = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return members.filter(
      (m) =>
        (show === "all" || (show === "in" ? picked.has(key(m)) : m.kind === show)) &&
        words.every((w) => m.name.toLowerCase().includes(w) || m.sub.toLowerCase().includes(w)),
    );
  }, [members, q, show, picked]);

  const toggle = (k: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(k);
      else next.delete(k);
      return next;
    });
  const allVisible = visible.length > 0 && visible.every((m) => picked.has(key(m)));
  const moving = members.filter((m) => picked.has(key(m)) && m.group && m.group !== groupName).length;

  return (
    <ActionForm action={action} keepValues className="space-y-6">
      {(state) => (
        <>
          <Field label="Group name" name="name" errors={state.fieldErrors} required hint='For example "Senior teachers" or "Support staff".'>
            <input name="name" required maxLength={60} defaultValue={name} className={inputClass} />
          </Field>

          <fieldset>
            <legend className="mb-1 text-sm font-medium text-fg-2">Leave days each session</legend>
            <p className="mb-3 text-xs text-muted">Working days. Leave a type blank for no limit.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {LEAVE_CATEGORIES.map((c) => (
                <label key={c} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
                  <span className="text-sm font-medium text-fg">{CATEGORY_LABELS[c]}</span>
                  <span className="flex items-center gap-1.5">
                    <input
                      type="number"
                      name={`d:${c}`}
                      min={0}
                      max={365}
                      step={1}
                      defaultValue={days[c] ?? ""}
                      placeholder="No limit"
                      aria-label={`${CATEGORY_LABELS[c]} days`}
                      className={`${inputClass} w-24`}
                    />
                    <span className="text-xs text-muted">days</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1 text-sm font-medium text-fg-2">
              Members <span className="font-normal text-muted">· {picked.size} chosen</span>
            </legend>
            <p className="mb-3 text-xs text-muted">Teachers and staff not in any group get the school-wide allowance.</p>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="relative min-w-48 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, ID or subject" className={`${inputClass} !pl-9`} />
              </span>
              {(
                [
                  ["all", "Everyone"],
                  ["teacher", "Teachers"],
                  ["staff", "Staff"],
                  ["in", "Chosen"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={show === k}
                  onClick={() => setShow(k)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition ${
                    show === k ? "bg-accent-soft text-accent-text ring-accent-line" : "bg-surface text-fg-2 ring-line hover:bg-surface-2"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="max-h-[28rem] overflow-y-auto rounded-xl border border-line">
              {visible.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">No one matches.</p>
              ) : (
                <>
                  <label className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-surface-2 px-4 py-2 text-xs font-medium text-fg-2">
                    <input
                      type="checkbox"
                      checked={allVisible}
                      onChange={(e) => setPicked((prev) => {
                        const next = new Set(prev);
                        for (const m of visible) {
                          if (e.target.checked) next.add(key(m));
                          else next.delete(key(m));
                        }
                        return next;
                      })}
                      className={checkboxClass}
                    />
                    {allVisible ? "Untick" : "Tick"} all {visible.length} shown
                  </label>
                  <ul className="divide-y divide-line">
                    {visible.map((m) => {
                      const k = key(m);
                      const elsewhere = m.group && m.group !== groupName;
                      return (
                        <li key={k}>
                          <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                            <input type="checkbox" checked={picked.has(k)} onChange={(e) => toggle(k, e.target.checked)} className={checkboxClass} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-fg">{m.name}</span>
                              <span className="block truncate text-xs text-muted">{m.sub}</span>
                            </span>
                            <Badge tone={m.kind === "teacher" ? "indigo" : "slate"}>{m.kind === "teacher" ? "Teacher" : "Staff"}</Badge>
                            {elsewhere && <Badge tone="amber">In {m.group}</Badge>}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
            {[...picked].map((k) => {
              const [kind, id] = k.split(":");
              return <input key={k} type="hidden" name={kind} value={id} />;
            })}
          </fieldset>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
            {moving > 0 && (
              <p className="mr-auto text-xs text-warning">
                {moving} {moving === 1 ? "person moves" : "people move"} here from another group.
              </p>
            )}
            <SubmitButton icon={<Save className="h-4 w-4" />}>Save group</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
