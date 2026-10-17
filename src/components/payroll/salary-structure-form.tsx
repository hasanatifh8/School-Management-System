"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { rupees } from "@/lib/fees-shared";
import { computeSalary, valueLabel, type ComponentDef } from "@/lib/payroll-shared";

/**
 * One person's salary: basic pay, and their own value for any component (blank
 * = the school's default), with gross, deductions and net worked out as you type.
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
  const [own, setOwn] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(initialOwn).map(([k, v]) => [k, String(v)])));
  const pay = useMemo(() => {
    const values: Record<string, number> = {};
    for (const [k, v] of Object.entries(own)) if (v.trim() !== "" && Number.isFinite(Number(v))) values[k] = Number(v);
    return computeSalary(Number(basic) || 0, components, values);
  }, [basic, own, components]);

  const row = (c: ComponentDef) => {
    const percent = c.calc === "PERCENT_OF_BASIC";
    const line = pay.lines.find((l) => l.name === c.name);
    return (
      <li key={c.id} className="flex flex-wrap items-center gap-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-fg">{c.name}</p>
          <p className="text-xs text-muted">Default: {c.defaultValue == null ? "none" : valueLabel(c.calc, c.defaultValue)}</p>
        </div>
        <div className="relative w-32">
          <input
            name={`c:${c.id}`}
            inputMode="decimal"
            value={own[c.id] ?? ""}
            onChange={(e) => setOwn((o) => ({ ...o, [c.id]: e.target.value.replace(/[^\d.]/g, "") }))}
            placeholder={c.defaultValue == null ? "—" : String(c.defaultValue)}
            aria-label={`${c.name} (${percent ? "% of basic" : "₹ a month"})`}
            className={`${inputClass} !py-2 tabular-nums ${percent ? "pr-7" : "pl-7"}`}
          />
          <span className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-xs text-subtle ${percent ? "right-3" : "left-3"}`}>{percent ? "%" : "₹"}</span>
        </div>
        <span className={`w-24 text-right text-sm tabular-nums ${line ? (c.kind === "DEDUCTION" ? "text-danger" : "text-fg") : "text-subtle"}`}>
          {line ? `${c.kind === "DEDUCTION" ? "−" : ""}${rupees(line.amount)}` : "—"}
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
        <p className="pb-2 text-xs text-muted">Leave a component blank to use the school&apos;s default.</p>
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
        <div className="grid gap-6 lg:grid-cols-2">
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
