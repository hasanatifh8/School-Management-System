"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, MapPin, Plus, X } from "lucide-react";
import { Button, IconButton, inputClass } from "@/components/ui";

/** `was` is the stop's saved name, so a rename keeps its students on the stop. */
type Row = { key: number; name: string; time: string; fare: string; was: string };

// Row keys only need to be unique on the page; a counter keeps them stable while rows move.
let lastKey = 0;
const row = (name = "", time = "", fare = ""): Row => ({ key: ++lastKey, name, time, fare, was: name });

/**
 * The stops of a route, in order, each with its pick-up time and monthly fare
 * (further stops usually cost more). Posts `stopName`, `stopTime`, `stopFare`
 * and `stopWas` once per row.
 */
export function StopsEditor({ stops, times, fares, error }: { stops: string[]; times: string[]; fares: number[]; error?: string }) {
  const [rows, setRows] = useState<Row[]>(() =>
    stops.length ? stops.map((s, i) => row(s, times[i] ?? "", fares[i] ? String(fares[i]) : "")) : [row()],
  );

  const change = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (i: number, by: number) =>
    setRows((rs) => {
      const out = [...rs];
      [out[i], out[i + by]] = [out[i + by], out[i]];
      return out;
    });
  const remove = (key: number) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : [row()]));

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-fg-2">Stops, in order</span>
        <span className="text-xs text-muted">Fare is per month and is added to the fees of every student at the stop.</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-line">
        <div className="hidden grid-cols-[2rem_1fr_8.5rem_8rem_6.5rem] gap-2 border-b border-line bg-surface-2 px-3 py-2 text-xs font-medium text-muted sm:grid">
          <span>#</span>
          <span>Stop name</span>
          <span>Pick-up time</span>
          <span>Monthly fare (₹)</span>
          <span className="sr-only">Order and remove</span>
        </div>
        <ol className="divide-y divide-line">
          {rows.map((r, i) => (
            <li key={r.key} className="grid grid-cols-[2rem_1fr_auto] items-center gap-2 px-3 py-2 sm:grid-cols-[2rem_1fr_8.5rem_8rem_6.5rem]">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold tabular-nums text-accent-text">{i + 1}</span>
              <input type="hidden" name="stopWas" value={r.was} />
              <input
                name="stopName"
                value={r.name}
                onChange={(e) => change(r.key, { name: e.target.value })}
                maxLength={60}
                placeholder={i === 0 ? "e.g. Hazratganj" : "Stop name"}
                aria-label={`Stop ${i + 1} name`}
                className={inputClass}
              />
              <div className="col-span-2 col-start-2 grid grid-cols-2 gap-2 sm:contents">
                <input
                  name="stopTime"
                  type="time"
                  value={r.time}
                  onChange={(e) => change(r.key, { time: e.target.value })}
                  aria-label={`Stop ${i + 1} pick-up time`}
                  className={`${inputClass} tabular-nums`}
                />
                <input
                  name="stopFare"
                  type="number"
                  min={0}
                  max={100000}
                  step={1}
                  inputMode="numeric"
                  value={r.fare}
                  onChange={(e) => change(r.key, { fare: e.target.value })}
                  placeholder="0"
                  aria-label={`Stop ${i + 1} monthly fare in rupees`}
                  className={`${inputClass} tabular-nums`}
                />
              </div>
              <div className="col-start-3 row-start-1 flex items-center justify-end gap-0.5 sm:col-start-auto sm:row-start-auto">
                <IconButton icon={ArrowUp} size="sm" label={`Move stop ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)} />
                <IconButton icon={ArrowDown} size="sm" label={`Move stop ${i + 1} down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)} />
                <IconButton icon={X} size="sm" label={`Remove stop ${i + 1}`} onClick={() => remove(r.key)} className="hover:text-danger" />
              </div>
            </li>
          ))}
        </ol>
        <div className="border-t border-line bg-surface-2/50 px-3 py-2">
          <Button type="button" variant="ghost" size="sm" icon={Plus} onClick={() => setRows((rs) => [...rs, row()])}>
            Add stop
          </Button>
        </div>
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-danger">{error}</p>
      ) : (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-muted">
          <MapPin className="h-3.5 w-3.5" /> Students choose their stop from this list. Blank rows are skipped; time and fare are optional.
        </p>
      )}
    </div>
  );
}

