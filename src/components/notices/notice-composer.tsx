"use client";

import { startTransition, useActionState, useMemo, useRef, useState } from "react";
import { Eye, Loader2, MessageCircle, MessageSquareText, Search, Send, TriangleAlert } from "lucide-react";
import { FormMessage } from "@/components/forms";
import { Badge, buttonVariants, checkboxClass, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { PLACEHOLDERS, TEMPLATES, smsParts } from "@/lib/messaging/providers";
import type { NoticePreview } from "@/app/admin/notices/actions";

type Audience = "classes" | "students" | "absent" | "school";
type Student = { id: string; name: string; className: string; hasPhone: boolean };

/**
 * Write a notice: who gets it, by WhatsApp and/or SMS, the message (with
 * {student}-style placeholders), then review the count and a sample before sending.
 */
export function NoticeComposer({
  mode,
  sections = [],
  students,
  channels,
  today,
  preview,
  send,
  absentDate,
}: {
  /** Open ready to message the parents of students absent on this date. */
  absentDate?: string;
  mode: "admin" | "teacher";
  sections?: { id: string; label: string; count: number }[];
  students: Student[];
  channels: { WHATSAPP: boolean; SMS: boolean };
  today: string;
  preview: (s: NoticePreview, f: FormData) => Promise<NoticePreview>;
  send: (s: ActionState, f: FormData) => Promise<ActionState>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const absentTemplate = TEMPLATES.find((t) => t.id === "absent")!;
  const [audience, setAudience] = useState<Audience>(absentDate ? "absent" : mode === "teacher" ? "school" : "classes");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState(absentDate ? absentTemplate.title : "");
  const [body, setBody] = useState(absentDate ? absentTemplate.body : "");
  const [changed, setChanged] = useState(true);
  const [previewState, runPreview, previewing] = useActionState(preview, {});
  const [sendState, runSend, sending] = useActionState(send, {});

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? students.filter((s) => `${s.name} ${s.className}`.toLowerCase().includes(q)) : students).slice(0, 60);
  }, [students, query]);
  const togglePick = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const insert = (token: string) => {
    const el = bodyRef.current;
    if (!el) return setBody((b) => b + token);
    const start = el.selectionStart ?? body.length;
    const next = body.slice(0, start) + token + body.slice(el.selectionEnd ?? start);
    setBody(next);
    requestAnimationFrame(() => el.setSelectionRange(start + token.length, start + token.length));
  };
  const review = () => {
    setChanged(false);
    startTransition(() => runPreview(new FormData(formRef.current!)));
  };
  const p = !changed && previewState.ok ? previewState.preview : undefined;
  const choices: { id: Audience; label: string; hint: string }[] =
    mode === "admin"
      ? [
          { id: "classes", label: "Classes", hint: "One or more classes" },
          { id: "students", label: "Students", hint: "Pick individual students" },
          { id: "absent", label: "Absent students", hint: "Marked absent on a day" },
          { id: "school", label: "Whole school", hint: "Every student" },
        ]
      : [
          { id: "school", label: "Whole class", hint: "Everyone in my class" },
          { id: "absent", label: "Absent students", hint: "Marked absent on a day" },
          { id: "students", label: "Choose students", hint: "Pick from my class" },
        ];

  return (
    <form
      ref={formRef}
      onChange={() => setChanged(true)}
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => runSend(new FormData(e.currentTarget)));
      }}
      className="space-y-6"
    >
      {/* 1. Who */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-[15px] font-semibold text-slate-900">1. Who should get it?</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {choices.map((c) => (
            <label key={c.id} className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3 text-sm transition hover:border-indigo-200 has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50/60">
              <input type="radio" name="audience" value={c.id} checked={audience === c.id} onChange={() => setAudience(c.id)} className="mt-0.5 accent-indigo-600" />
              <span>
                <span className="block font-medium text-slate-900">{c.label}</span>
                <span className="block text-xs text-slate-500">{c.hint}</span>
              </span>
            </label>
          ))}
        </div>

        {audience === "classes" && (
          <fieldset className="mt-4">
            <legend className="sr-only">Classes</legend>
            <div className="mb-2 flex gap-3 text-xs">
              <button type="button" className="font-medium text-indigo-600" onClick={() => formRef.current?.querySelectorAll<HTMLInputElement>("input[name=sectionIds]").forEach((i) => (i.checked = true))}>
                Select all
              </button>
              <button type="button" className="font-medium text-slate-500" onClick={() => formRef.current?.querySelectorAll<HTMLInputElement>("input[name=sectionIds]").forEach((i) => (i.checked = false))}>
                Clear
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
              {sections.map((s) => (
                <label key={s.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm has-[:checked]:border-indigo-300 has-[:checked]:bg-indigo-50/60">
                  <input type="checkbox" name="sectionIds" value={s.id} className={checkboxClass} />
                  <span className="flex-1">{s.label}</span>
                  <span className="text-xs text-slate-400">{s.count}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {audience === "students" && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or class" aria-label="Search students" className={`${inputClass} pl-9`} />
              </div>
              <ul className="mt-2 max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                {matches.map((s) => (
                  <li key={s.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                      <input type="checkbox" checked={picked.has(s.id)} onChange={() => togglePick(s.id)} className={checkboxClass} />
                      <span className="flex-1">
                        {s.name}
                        <span className="ml-2 text-xs text-slate-500">{s.className}</span>
                      </span>
                      {!s.hasPhone && <Badge tone="amber">No phone</Badge>}
                    </label>
                  </li>
                ))}
                {matches.length === 0 && <li className="px-3 py-4 text-center text-sm text-slate-500">No match</li>}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">{picked.size} chosen</p>
              <div className="flex flex-wrap gap-1.5">
                {students
                  .filter((s) => picked.has(s.id))
                  .map((s) => (
                    <button key={s.id} type="button" onClick={() => togglePick(s.id)} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200 hover:bg-indigo-100" title="Remove">
                      {s.name} ×
                    </button>
                  ))}
              </div>
              {[...picked].map((id) => (
                <input key={id} type="hidden" name="studentIds" value={id} />
              ))}
            </div>
          </div>
        )}

        {audience === "absent" && (
          <div className="mt-4 flex flex-wrap items-start gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Absent on</span>
              <input type="date" name="date" defaultValue={absentDate ?? today} max={today} className={inputClass} />
            </label>
            {mode === "admin" && (
              <fieldset className="min-w-60 flex-1">
                <legend className="mb-1.5 text-sm font-medium text-slate-700">Classes (leave all unticked for every class)</legend>
                <div className="grid gap-1.5 sm:grid-cols-3 xl:grid-cols-5">
                  {sections.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="absentSectionIds" value={s.id} className={checkboxClass} />
                      {s.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <p className="basis-full text-xs text-slate-500">Uses the attendance marked for that day. Tip: pick the “Absent today” template below.</p>
          </div>
        )}
      </section>

      {/* 2. How */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-[15px] font-semibold text-slate-900">2. Send by</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {(
            [
              ["WHATSAPP", "WhatsApp", MessageCircle],
              ["SMS", "SMS", MessageSquareText],
            ] as const
          ).map(([id, label, Icon]) => (
            <label key={id} className={`flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm ${channels[id] ? "cursor-pointer has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50/60" : "opacity-60"}`}>
              <input type="checkbox" name="channels" value={id} disabled={!channels[id]} defaultChecked={channels[id] && id === "WHATSAPP"} className={checkboxClass} />
              <Icon className="h-4 w-4 text-slate-500" />
              <span className="font-medium text-slate-900">{label}</span>
              {!channels[id] && <span className="text-xs text-slate-500">Not set up{mode === "admin" ? " (Settings tab)" : ""}</span>}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">WhatsApp goes to the student&apos;s WhatsApp number (or phone if none); SMS goes to the phone number.</p>
      </section>

      {/* 3. What */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-[15px] font-semibold text-slate-900">3. Message</h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="mr-1 self-center text-xs text-slate-500">Start from:</span>
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTitle(t.title);
                setBody(t.body);
                setChanged(true);
                if (t.id === "absent") setAudience("absent");
              }}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          <label className="block max-w-xl">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Title (for your records)</span>
            <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="e.g. Annual Day invitation" className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Message</span>
            <textarea ref={bodyRef} name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={1000} className={inputClass} />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <span className="mr-1 self-center text-xs text-slate-500">Insert:</span>
              {PLACEHOLDERS.map((ph) => (
                <button key={ph.token} type="button" onClick={() => insert(ph.token)} title={ph.label} className="rounded-md bg-indigo-50 px-2 py-0.5 font-mono text-xs text-indigo-700 hover:bg-indigo-100">
                  {ph.token}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              {body.length}/1000 · about {smsParts(body)} SMS part{smsParts(body) === 1 ? "" : "s"} each
            </p>
          </div>
          {/<[a-z ]+>/i.test(body) && (
            <p className="flex items-center gap-1.5 text-xs text-amber-700">
              <TriangleAlert className="h-3.5 w-3.5" /> Replace the parts in &lt;angle brackets&gt; before sending.
            </p>
          )}
        </div>
      </section>

      {/* 4. Review & send */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-slate-900">4. Review and send</h2>
          <button type="button" onClick={review} disabled={previewing} className={buttonVariants.secondary}>
            {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Review
          </button>
        </div>
        {!changed && previewState.error && (
          <div className="mt-3">
            <FormMessage state={previewState} />
          </div>
        )}
        {p && (
          <div className="mt-4 space-y-4">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <dt className="text-xs text-slate-500">Going to</dt>
                <dd className="text-sm font-medium text-slate-900">{p.label}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Students</dt>
                <dd className="text-xl font-semibold tabular-nums">{p.students}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Messages to send</dt>
                <dd className="text-xl font-semibold tabular-nums text-indigo-600">{p.messages}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Skipped (no number)</dt>
                <dd className={`text-xl font-semibold tabular-nums ${p.skipped ? "text-amber-600" : ""}`}>{p.skipped}</dd>
              </div>
            </dl>
            {p.sample && (
              <div className="max-w-md rounded-2xl rounded-tl-sm bg-emerald-50 px-4 py-3 text-sm text-slate-800 ring-1 ring-inset ring-emerald-100">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-emerald-700">Sample · to {p.sample.name}</p>
                <p className="whitespace-pre-wrap">{p.sample.message}</p>
              </div>
            )}
            <FormMessage state={sendState} />
            <button
              type="submit"
              disabled={sending || !p.messages}
              onClick={(e) => {
                if (!window.confirm(`Send ${p.messages} message(s) now? This can't be undone.`)) e.preventDefault();
              }}
              className={buttonVariants.primary}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send {p.messages} message{p.messages === 1 ? "" : "s"}
            </button>
          </div>
        )}
        {changed && <p className="mt-2 text-sm text-slate-500">Click Review to see how many messages will go out and a sample.</p>}
      </section>
    </form>
  );
}
