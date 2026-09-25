"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type Counts = { PENDING: number; SENT: number; FAILED: number; SKIPPED: number; total: number };

/**
 * Shows sending progress and helps send while the page is open (the server also
 * keeps sending in the background), then refreshes the recipient list.
 */
export function DeliveryProgress({ initial, process }: { initial: Counts; process: () => Promise<Counts | null> }) {
  const router = useRouter();
  const [counts, setCounts] = useState(initial);
  const running = useRef(false);

  useEffect(() => {
    if (running.current || initial.PENDING === 0) return;
    running.current = true;
    (async () => {
      let c: Counts | null = initial;
      while (c && c.PENDING > 0) {
        const before: Counts = c;
        c = await process();
        if (c) setCounts(c);
        // The background sender may hold the batch; wait instead of hammering.
        if (c && c.PENDING === before.PENDING) await new Promise((r) => setTimeout(r, 1500));
      }
      running.current = false;
      router.refresh();
    })();
  }, [initial, process, router]);

  const done = counts.SENT + counts.FAILED + counts.SKIPPED;
  const pct = counts.total ? Math.round((done / counts.total) * 100) : 100;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-medium text-slate-700">
          {counts.PENDING > 0 && <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />}
          {counts.PENDING > 0 ? `Sending… ${done} of ${counts.total}` : "Finished"}
        </span>
        <span className="tabular-nums text-slate-500">{pct}%</span>
      </div>
      <div className="mt-2 flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-slate-100">
        <div className="bg-emerald-500" style={{ width: `${(counts.SENT / Math.max(1, counts.total)) * 100}%` }} />
        <div className="bg-rose-500" style={{ width: `${(counts.FAILED / Math.max(1, counts.total)) * 100}%` }} />
        <div className="bg-amber-400" style={{ width: `${(counts.SKIPPED / Math.max(1, counts.total)) * 100}%` }} />
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div>
          <dt className="inline text-slate-500">Sent </dt>
          <dd className="inline font-semibold tabular-nums text-emerald-700">{counts.SENT}</dd>
        </div>
        <div>
          <dt className="inline text-slate-500">Failed </dt>
          <dd className="inline font-semibold tabular-nums text-rose-700">{counts.FAILED}</dd>
        </div>
        <div>
          <dt className="inline text-slate-500">Skipped (no number) </dt>
          <dd className="inline font-semibold tabular-nums text-amber-700">{counts.SKIPPED}</dd>
        </div>
        {counts.PENDING > 0 && (
          <div>
            <dt className="inline text-slate-500">Waiting </dt>
            <dd className="inline font-semibold tabular-nums">{counts.PENDING}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
