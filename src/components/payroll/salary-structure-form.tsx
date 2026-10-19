"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, inputClass, selectClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { rupees } from "@/lib/fees-shared";
import { computeSalary, valueLabel, type ComponentDef } from "@/lib/payroll-shared";

/** How one component applies to this person: the school's default, their own value, or not at all. */
type Mode = "default" | "own" | "off";

/** What gets saved for a component: blank = the default, 0 = not applied (only needed when there is a default), else the own value. */
const sentValue = (c: ComponentDef, mode: Mode, value: string | undefined) =>
  mode === "default" ? "" : mode === "off" ? (c.defaultValue == null ? "" : "0") : (value ?? "");

/**
 * One person's salary: basic pay, and for each component an explicit choice:
 * the school's default, their own value, or not applied (saved as 0). Gross,
 * deductions and net are worked out as you type.
 */
export function SalaryStructureForm({
  action,
  basic: initialBasic,
  components,
  own: initialOwn,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  basic: number | null;
  components: ComponentDef[];
  own: Record<string, number>;
}) {
  const [basic, setBasic] = useState(initialBasic == null ? "" : String(initialBasic));
  const [mode, setMode] = useState<Record<string, Mode>>(() =>
    Object.fromEntries(components.map((c) => [c.id, initialOwn[c.id] == null ? (c.defaultValue == null ? "off" : "default") : initialOwn[c.id] === 0 ? "off" : "own"])),
  );
  const [value, setValue] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(initialOwn).filter(([, v]) => v !== 0).map(([k, v]) => [k, String(v)])),
  );
  const sent = (c: ComponentDef) => sentValue(c, mode[c.id], value[c.id]);
  const pay = useMemo(() => {
    const values: Record<string, number> = {};
    for (const c of components) {
      const v = sentValue(c, mode[c.id], value[c.id]);
      if (v !== "" && Number.isFinite(Number(v))) values[c.id] = Number(v);
    }
    return computeSalary(Number(basic) || 0, components, values);
  }, [basic, mode, value, components]);

  const row = (c: ComponentDef) => {
    const percent = c.calc === "PERCENT_OF_BASIC";
    const m = mode[c.id];
    const line = pay.lines.find((l) => l.name === c.name);
    return (
      <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
        <input type="hidden" name={`c:${c.id}`} value={sent(c)} />
        <div className="min-w-0 flex-1 basis-40">
          <p className="text-sm font-medium text-fg">{c.name}</p>
          <p className="text-xs text-muted">School default: {c.defaultValue == null ? "none" : valueLabel(c.calc, c.defaultValue)} · every month</p>
        </div>
        <select
          value={m}
          onChange={(e) => setMode((s) => ({ ...s, [c.id]: e.target.value as Mode }))}
          aria-label={`${c.name}: how it applies`}
          className={`${selectClass} !w-40 !py-2 text-sm`}
        >
          {c.defaultValue != null && <option value="default">School default</option>}
          <option value="own">Own value</option>
          <option value="off">Not applied</option>
        </select>
        <div className="relative w-28">
          <input
            inputMode="decimal"
            value={m === "own" ? (value[c.id] ?? "") : m === "default" && c.defaultValue != null ? String(c.defaultValue) : ""}
            onChange={(e) => setValue((o) => ({ ...o, [c.id]: e.target.value.replace(/[^\d.]/g, "") }))}
            disabled={m !== "own"}
            required={m === "own"}
            placeholder={m === "off" ? "—" : percent ? "%" : "₹"}
            aria-label={`${c.name} (${percent ? "% of basic" : "₹ a month"})`}
            className={`${inputClass} !py-2 tabular-nums disabled:opacity-50 ${percent ? "pr-7" : "pl-7"}`}
          />
          <span className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-xs text-subtle ${percent ? "right-3" : "left-3"}`}>{percent ? "%" : "₹"}</span>
        </div>
        <span className={`w-24 text-right text-sm tabular-nums ${line ? (c.kind === "DEDUCTION" ? "text-danger" : "text-fg") : "text-subtle"}`}>
          {line ? `${c.kind === "DEDUCTION" ? "−" : ""}${rupees(line.amount)}` : "Not applied"}
        </span>
      </li>
    );
  };
  const earnings = components.filter((c) => c.kind === "EARNING");
  const deductions = components.filter((c) => c.kind === "DEDUCTION");

  return (
    <ActionForm action={action} keepValues className="space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-fg-2">Basic pay (₹ a month)</span>
          <div className="relative w-44">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">₹</span>
            <input name="basic" inputMode="numeric" value={basic} onChange={(e) => setBasic(e.target.value.replace(/[^\d]/g, ""))} placeholder="e.g. 30000" className={`${inputClass} pl-7 tabular-nums`} />
          </div>
        </label>
        <p className="pb-2 text-xs text-muted">For each component choose the school&apos;s default, an own value for this person, or not applied.</p>
      </div>

      {components.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">
          Only basic pay so far.{" "}
          <Link href="/admin/settings/payroll" className="font-medium text-accent-text hover:underline">
            Add earnings and deductions
          </Link>{" "}
          like HRA or PF in Settings → Payroll.
        </p>
      ) : (
        <div className="space-y-5">
          {[
            { title: "Earnings", list: earnings, tone: "green" as const },
            { title: "Deductions", list: deductions, tone: "red" as const },
          ].map((g) => (
            <section key={g.title}>
              <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
                {g.title} <Badge tone={g.tone}>{g.list.length}</Badge>
              </h3>
              {g.list.length ? <ul className="divide-y divide-line">{g.list.map(row)}</ul> : <p className="py-2.5 text-sm text-subtle">None set up.</p>}
            </section>
          ))}
          <p className="text-xs text-muted">
            Deductions here are taken off <strong className="font-medium text-fg-2">every month</strong>. Absences are deducted separately as loss of pay (Settings →
            Payroll → Deduction for absent days).
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 rounded-xl bg-surface-2 p-4 text-center">
        <div>
          <p className="text-xs text-muted">Gross</p>
          <p className="text-lg font-semibold tabular-nums text-fg">{rupees(pay.gross)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Deductions</p>
          <p className="text-lg font-semibold tabular-nums text-danger">{rupees(pay.deductions)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Net a month</p>
          <p className="text-lg font-semibold tabular-nums text-success">{rupees(pay.net)}</p>
        </div>
      </div>

      <SubmitButton icon={<Save className="h-4 w-4" />}>Save salary</SubmitButton>
    </ActionForm>
  );
}
