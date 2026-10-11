"use client";

import { useState, useTransition } from "react";
import { CheckCheck, Loader2, UserRoundPlus, X } from "lucide-react";
import { Badge, Button, Modal, selectClass, useToast } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { periodTime } from "@/lib/timetable-shared";

type Period = {
  slotId: string;
  period: { id: string; name: string; startTime: string; endTime: string };
  section: string;
  subject: string;
  proxy: { id: string; teacherId: string; name: string } | null;
};
type Free = { id: string; name: string; department: string; load: number };

/**
 * "Assign proxy" for one teacher who is away: a modal with each of their
 * periods that day and a free teacher for each (the least busy is suggested).
 */
export function ProxyAssign({
  teacherName,
  date,
  periods,
  free,
  assign,
  remove,
}: {
  teacherName: string;
  date: string;
  periods: Period[];
  free: Record<string, Free[]>;
  assign: (state: ActionState, formData: FormData) => Promise<ActionState>;
  remove: (id: string) => Promise<ActionState>;
}) {
  const [open, setOpen] = useState(false);
  const covered = periods.filter((p) => p.proxy).length;
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const toast = useToast();
  const pick = (p: Period) => choice[p.slotId] ?? free[p.period.id]?.[0]?.id ?? "";

  async function save(p: Period, teacherId: string) {
    const fd = new FormData();
    fd.set("slotId", p.slotId);
    fd.set("date", date);
    fd.set("proxyTeacherId", teacherId);
    const r = await assign({}, fd);
    setErrors((e) => ({ ...e, [p.slotId]: r.error ?? "" }));
    return r;
  }

  const run = (slot: string | null, job: () => Promise<void>) => {
    setBusySlot(slot);
    start(async () => {
      await job();
      setBusySlot(null);
    });
  };

  const open_ = periods.filter((p) => !p.proxy && pick(p));

  return (
    <>
      <Button size="sm" variant={covered === periods.length ? "secondary" : "primary"} icon={UserRoundPlus} onClick={() => setOpen(true)}>
        {covered === periods.length ? "Proxies set" : "Assign proxy"}
        <span className="tabular-nums opacity-80">
          {covered}/{periods.length}
        </span>
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          size="lg"
          title={`Proxy for ${teacherName}`}
          description={`${periods.length} period${periods.length === 1 ? "" : "s"} to cover · ${covered} covered`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Done
              </Button>
              {open_.length > 0 && (
                <Button
                  icon={CheckCheck}
                  loading={pending && busySlot === "all"}
                  disabled={pending}
                  onClick={() =>
                    run("all", async () => {
                      let ok = 0;
                      for (const p of open_) if ((await save(p, pick(p))).ok) ok++;
                      toast({ title: `Assigned ${ok} of ${open_.length} period${open_.length === 1 ? "" : "s"}` });
                    })
                  }
                >
                  Assign all suggested ({open_.length})
                </Button>
              )}
            </>
          }
        >
          <ul className="divide-y divide-line">
            {periods.map((p) => {
              const options = free[p.period.id] ?? [];
              const loading = pending && busySlot === p.slotId;
              return (
                <li key={p.slotId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="text-sm font-medium text-fg">
                      {p.period.name} <span className="font-normal text-muted">· {periodTime(p.period)}</span>
                    </p>
                    <p className="text-xs text-muted">
                      {p.section}
                      {p.subject ? ` · ${p.subject}` : ""}
                    </p>
                    {errors[p.slotId] && <p className="mt-1 text-xs text-danger">{errors[p.slotId]}</p>}
                  </div>
                  {p.proxy ? (
                    <div className="flex items-center gap-2">
                      <Badge tone="green" dot>
                        {p.proxy.name}
                      </Badge>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          run(p.slotId, async () => {
                            const r = await remove(p.proxy!.id);
                            toast(r.ok ? { title: r.message ?? "Removed" } : { title: r.error ?? "Couldn't remove it", tone: "error" });
                          })
                        }
                        aria-label={`Remove ${p.proxy.name} from ${p.period.name}`}
                        className="rounded-lg p-1.5 text-subtle transition hover:bg-danger-soft hover:text-danger"
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      </button>
                    </div>
                  ) : options.length === 0 ? (
                    <Badge tone="amber">No teacher free</Badge>
                  ) : (
                    <div className="flex w-full items-center gap-2 sm:w-auto">
                      <select
                        aria-label={`Proxy for ${p.period.name}`}
                        value={pick(p)}
                        onChange={(e) => setChoice((c) => ({ ...c, [p.slotId]: e.target.value }))}
                        className={`${selectClass} h-9 min-w-0 flex-1 py-0 text-sm sm:w-60`}
                      >
                        {options.map((t, i) => (
                          <option key={t.id} value={t.id}>
                            {t.name} · {t.department} · {t.load} period{t.load === 1 ? "" : "s"}
                            {i === 0 ? " (suggested)" : ""}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        loading={loading}
                        disabled={pending}
                        onClick={() =>
                          run(p.slotId, async () => {
                            const r = await save(p, pick(p));
                            if (r.ok) toast({ title: r.message ?? "Proxy assigned" });
                          })
                        }
                      >
                        Assign
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Modal>
      )}
    </>
  );
}
