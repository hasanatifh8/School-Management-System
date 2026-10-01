"use client";

import { startTransition, useActionState, useMemo, useRef, useState } from "react";
import { CalendarClock, Eye, Loader2, MessageCircle, MessageSquareText, Paperclip, Presentation, Search, Send, TriangleAlert, UserCog } from "lucide-react";
import { FormMessage } from "@/components/forms";
import { Badge, buttonVariants, checkboxClass, inputClass, useConfirm } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { PLACEHOLDERS, TEMPLATES, smsParts } from "@/lib/messaging/providers";
import type { NoticePreview } from "@/app/admin/notices/actions";
import { addDays } from "@/lib/attendance-shared";
import { ATTACHMENT_ACCEPT } from "@/lib/notices-shared";

type Audience = "classes" | "students" | "absent" | "school" | "none";
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
  people,
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
  /** Admins only: active teachers and staff, to add them as recipients. */
  people?: { teachers: number; staff: number };
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
  const [publishDate, setPublishDate] = useState(today);
  const [expiryDate, setExpiryDate] = useState(addDays(today, 7));
  const [previewState, runPreview, previewing] = useActionState(preview, {});
  const [sendState, runSend, sending] = useActionState(send, {});
  const confirm = useConfirm();

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
          { id: "none", label: "No students", hint: "Only teachers or staff" },
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
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <h2 className="text-base font-semibold text-fg">1. Who should get it?</h2>
        <p className="mt-1 text-xs text-muted">Students: their parents get the message.</p>
        <div className={`mt-3 grid gap-2 sm:grid-cols-2 ${mode === "admin" ? "xl:grid-cols-5" : "xl:grid-cols-3"}`}>
          {choices.map((c) => (
            <label key={c.id} className="flex cursor-pointer gap-3 rounded-xl border border-line p-3 text-sm transition hover:border-accent-line has-[:checked]:border-accent has-[:checked]:bg-accent-soft/60">
              <input type="radio" name="audience" value={c.id} checked={audience === c.id} onChange={() => setAudience(c.id)} className="mt-0.5 accent-accent" />
              <span>
                <span className="block font-medium text-fg">{c.label}</span>
                <span className="block text-xs text-muted">{c.hint}</span>
              </span>
            </label>
          ))}
        </div>

        {audience === "classes" && (
          <fieldset className="mt-4">
            <legend className="sr-only">Classes</legend>
            <div className="mb-2 flex gap-3 text-xs">
              <button type="button" className="font-medium text-accent-text" onClick={() => formRef.current?.querySelectorAll<HTMLInputElement>("input[name=sectionIds]").forEach((i) => (i.checked = true))}>
                Select all
              </button>
              <button type="button" className="font-medium text-muted" onClick={() => formRef.current?.querySelectorAll<HTMLInputElement>("input[name=sectionIds]").forEach((i) => (i.checked = false))}>
                Clear
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
              {sections.map((s) => (
                <label key={s.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm has-[:checked]:border-accent-line has-[:checked]:bg-accent-soft/60">
                  <input type="checkbox" name="sectionIds" value={s.id} className={checkboxClass} />
                  <span className="flex-1">{s.label}</span>
                  <span className="text-xs text-subtle">{s.count}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {audience === "students" && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or class" aria-label="Search students" className={`${inputClass} pl-9`} />
              </div>
              <ul className="mt-2 max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
                {matches.map((s) => (
                  <li key={s.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-surface-2">
                      <input type="checkbox" checked={picked.has(s.id)} onChange={() => togglePick(s.id)} className={checkboxClass} />
                      <span className="flex-1">
                        {s.name}
                        <span className="ml-2 text-xs text-muted">{s.className}</span>
                      </span>
                      {!s.hasPhone && <Badge tone="amber">No phone</Badge>}
                    </label>
                  </li>
                ))}
                {matches.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted">No match</li>}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-fg-2">{picked.size} chosen</p>
              <div className="flex flex-wrap gap-1.5">
                {students
                  .filter((s) => picked.has(s.id))
                  .map((s) => (
                    <button key={s.id} type="button" onClick={() => togglePick(s.id)} className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-text ring-1 ring-inset ring-accent-line hover:bg-accent-soft" title="Remove">
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
              <span className="mb-1.5 block text-sm font-medium text-fg-2">Absent on</span>
              <input type="date" name="date" defaultValue={absentDate ?? today} max={today} className={inputClass} />
            </label>
            {mode === "admin" && (
              <fieldset className="min-w-60 flex-1">
                <legend className="mb-1.5 text-sm font-medium text-fg-2">Classes (leave all unticked for every class)</legend>
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
            <p className="basis-full text-xs text-muted">Uses the attendance marked for that day. Tip: pick the “Absent today” template below.</p>
          </div>
        )}

        {people && (
          <fieldset className="mt-5 border-t border-line pt-4">
            <legend className="mb-2 text-sm font-medium text-fg-2">Also send to</legend>
            <div className="flex flex-wrap gap-3">
              {(
                [
                  ["toTeachers", "Teachers", Presentation, people.teachers, "On their phone and the teacher portal"],
                  ["toStaff", "Non-teaching staff", UserCog, people.staff, "On their phone; cashiers also see it in Fees"],
                ] as const
              ).map(([name, label, Icon, count, hint]) => (
                <label key={name} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-4 py-3 text-sm transition hover:border-accent-line has-[:checked]:border-accent has-[:checked]:bg-accent-soft/60">
                  <input type="checkbox" name={name} className={`${checkboxClass} mt-0.5`} />
                  <Icon className="mt-0.5 h-4 w-4 text-muted" />
                  <span>
                    <span className="block font-medium text-fg">
                      {label} <span className="font-normal text-subtle">({count})</span>
                    </span>
                    <span className="block text-xs text-muted">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </section>

      {/* 2. How */}
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <h2 className="text-base font-semibold text-fg">2. Send by</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {(
            [
              ["WHATSAPP", "WhatsApp", MessageCircle],
              ["SMS", "SMS", MessageSquareText],
            ] as const
          ).map(([id, label, Icon]) => (
            <label key={id} className={`flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm ${channels[id] ? "cursor-pointer has-[:checked]:border-accent has-[:checked]:bg-accent-soft/60" : "opacity-60"}`}>
              <input type="checkbox" name="channels" value={id} disabled={!channels[id]} defaultChecked={channels[id] && id === "WHATSAPP"} className={checkboxClass} />
              <Icon className="h-4 w-4 text-muted" />
              <span className="font-medium text-fg">{label}</span>
              {!channels[id] && <span className="text-xs text-muted">Not set up{mode === "admin" ? " (Settings tab)" : ""}</span>}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">WhatsApp goes to the student&apos;s WhatsApp number (or phone if none); SMS goes to the phone number.</p>
      </section>

      {/* 3. What */}
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <h2 className="text-base font-semibold text-fg">3. Message</h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="mr-1 self-center text-xs text-muted">Start from:</span>
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
              className="rounded-full bg-surface-3 px-3 py-1 text-xs font-medium text-fg-2 hover:bg-surface-3"
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          <label className="block max-w-xl">
            <span className="mb-1.5 block text-sm font-medium text-fg-2">Notice title</span>
            <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="e.g. Annual Day invitation" className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-fg-2">Description / message</span>
            <textarea ref={bodyRef} name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={1000} className={inputClass} />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <span className="mr-1 self-center text-xs text-muted">Insert:</span>
              {PLACEHOLDERS.map((ph) => (
                <button key={ph.token} type="button" onClick={() => insert(ph.token)} title={ph.label} className="rounded-md bg-accent-soft px-2 py-0.5 font-mono text-xs text-accent-text hover:bg-accent-soft">
                  {ph.token}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">
              {body.length}/1000 · about {smsParts(body)} SMS part{smsParts(body) === 1 ? "" : "s"} each
            </p>
          </div>
          <div className="grid gap-3 pt-2 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-fg-2">Publish date</span>
              <input
                type="date"
                name="publishDate"
                required
                value={publishDate}
                min={today}
                onChange={(e) => {
                  setPublishDate(e.target.value);
                  if (e.target.value && expiryDate < e.target.value) setExpiryDate(addDays(e.target.value, 7));
                }}
                className={inputClass}
              />
              <span className="mt-1 block text-xs text-muted">{publishDate > today ? "Messages go out at 7 AM on this day." : "Messages go out as soon as you send."}</span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-fg-2">Expiry date</span>
              <input type="date" name="expiryDate" required value={expiryDate} min={publishDate} onChange={(e) => setExpiryDate(e.target.value)} className={inputClass} />
              <span className="mt-1 block text-xs text-muted">Active until the end of this day; the attachment link stops working after it.</span>
            </label>
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-fg-2">
                <Paperclip className="h-4 w-4" /> Attachment (optional)
              </span>
              <input
                type="file"
                name="attachment"
                accept={ATTACHMENT_ACCEPT}
                className="block w-full text-sm text-fg-2 file:mr-3 file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent-text hover:file:bg-accent-soft/70"
              />
              <span className="mt-1 block text-xs text-muted">PDF, PNG or JPG up to 4 MB. Messages include a link to it.</span>
            </label>
          </div>
          {/<[a-z ]+>/i.test(body) && (
            <p className="flex items-center gap-1.5 text-xs text-warning">
              <TriangleAlert className="h-3.5 w-3.5" /> Replace the parts in &lt;angle brackets&gt; before sending.
            </p>
          )}
        </div>
      </section>

      {/* 4. Review & send */}
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-fg">4. Review and send</h2>
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
                <dt className="text-xs text-muted">Going to</dt>
                <dd className="text-sm font-medium text-fg">{p.label}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">People</dt>
                <dd className="text-2xl font-semibold tabular-nums text-fg">{p.people}</dd>
                <dd className="text-xs text-muted">
                  {[p.students && `${p.students} students`, p.teachers && `${p.teachers} teachers`, p.staff && `${p.staff} staff`].filter(Boolean).join(" · ")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Messages to send</dt>
                <dd className="text-2xl font-semibold tabular-nums text-accent-text">{p.messages}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Skipped (no number)</dt>
                <dd className={`text-2xl font-semibold tabular-nums ${p.skipped ? "text-warning" : "text-fg"}`}>{p.skipped}</dd>
              </div>
            </dl>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-2">
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4 text-muted" />
                {p.scheduled ? `Scheduled for ${p.publishLabel}` : "Sends now"} · active until {p.expiryLabel}
              </span>
              {p.attachment && (
                <span className="inline-flex items-center gap-1.5">
                  <Paperclip className="h-4 w-4 text-muted" /> {p.attachment}
                </span>
              )}
            </p>
            {p.sample && (
              <div className="max-w-md rounded-2xl rounded-tl-sm bg-success-soft px-4 py-3 text-sm text-fg ring-1 ring-inset ring-success-line">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-success">Sample · to {p.sample.name}</p>
                <p className="whitespace-pre-wrap">{p.sample.message}</p>
              </div>
            )}
            <FormMessage state={sendState} />
            <button
              type="submit"
              disabled={sending || !p.messages}
              onClick={(e) => {
                e.preventDefault();
                const button = e.currentTarget;
                confirm(
                  p.scheduled
                    ? { title: `Schedule ${p.messages} message(s) for ${p.publishLabel}?`, message: "They go out automatically on that day.", confirmLabel: "Schedule" }
                    : { title: `Send ${p.messages} message(s) now?`, message: "Messages can't be recalled once sent.", confirmLabel: "Send" },
                ).then(
                  (ok) => ok && button.form?.requestSubmit(button),
                );
              }}
              className={buttonVariants.primary}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {p.scheduled ? "Schedule" : "Send"} {p.messages} message{p.messages === 1 ? "" : "s"}
            </button>
          </div>
        )}
        {changed && <p className="mt-2 text-sm text-muted">Click Review to see how many messages will go out and a sample.</p>}
      </section>
    </form>
  );
}
