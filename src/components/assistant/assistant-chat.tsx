"use client";

import { useEffect, useRef, useState, useTransition, type ComponentType } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Check,
  ClipboardList,
  Copy,
  Cpu,
  GraduationCap,
  LayoutDashboard,
  Lock,
  Megaphone,
  PiggyBank,
  Presentation,
  RotateCcw,
  School,
  ShieldCheck,
  Sparkles,
  SquarePen,
  TriangleAlert,
  UserCog,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button, IconTile, PageHeader, cx, type IconTone } from "@/components/ui";
import type { AskResult } from "@/app/admin/assistant/actions";
import { Markdown } from "./markdown";

type Message = { role: "user" | "assistant"; content: string; tools?: string[] };

/* ───────────────────────── Content ───────────────────────── */

const TOPICS: { title: string; icon: LucideIcon; tone: IconTone; prompts: string[] }[] = [
  { title: "Students", icon: GraduationCap, tone: "indigo", prompts: ["How many students are in each class?", "Students with a birthday this month"] },
  { title: "Attendance", icon: CalendarCheck, tone: "emerald", prompts: ["Who is absent today?", "Students below 75% attendance this session"] },
  { title: "Fees", icon: Wallet, tone: "amber", prompts: ["Top 10 students with pending fees", "Fees collected this month by payment mode"] },
  { title: "Expenses", icon: PiggyBank, tone: "rose", prompts: ["This month's expenses vs budget", "Whose salary is still to be paid?"] },
  { title: "Exams", icon: ClipboardList, tone: "violet", prompts: ["Which exams are there this session?", "Toppers of the latest exam"] },
  { title: "Calendar", icon: CalendarDays, tone: "sky", prompts: ["Upcoming holidays and events", "Who teaches Maths, and in which classes?"] },
];

/** What each lookup is called for people, and where it lives in the app. */
const TOOL_INFO: Record<string, { label: string; icon: LucideIcon; href: string; section: string }> = {
  school_overview: { label: "School overview", icon: LayoutDashboard, href: "/admin", section: "Dashboard" },
  list_classes: { label: "Classes", icon: School, href: "/admin/classes", section: "Classes" },
  search_students: { label: "Students", icon: GraduationCap, href: "/admin/students", section: "Students" },
  student_profile: { label: "Student profile", icon: GraduationCap, href: "/admin/students", section: "Students" },
  search_teachers: { label: "Teachers", icon: Presentation, href: "/admin/teachers", section: "Teachers" },
  list_staff: { label: "Staff", icon: UserCog, href: "/admin/staff", section: "Staff" },
  attendance_on_date: { label: "Attendance", icon: CalendarCheck, href: "/admin/attendance", section: "Attendance" },
  attendance_report: { label: "Attendance report", icon: CalendarCheck, href: "/admin/attendance", section: "Attendance" },
  fee_dues: { label: "Fee dues", icon: Wallet, href: "/admin/fees", section: "Fees" },
  fee_collection: { label: "Fee collection", icon: Wallet, href: "/admin/fees", section: "Fees" },
  expenses_report: { label: "Expenses", icon: PiggyBank, href: "/admin/expenses", section: "Expenses" },
  list_exams: { label: "Exams", icon: ClipboardList, href: "/admin/exams", section: "Exams" },
  exam_results: { label: "Exam results", icon: ClipboardList, href: "/admin/exams", section: "Exams" },
  calendar: { label: "Calendar", icon: CalendarDays, href: "/admin/calendar", section: "Calendar" },
  timetable: { label: "Timetable", icon: CalendarClock, href: "/admin/timetable", section: "Timetable" },
};
// Answers about dues or absences usually lead to messaging parents.
const NOTICE_AFTER = new Set(["fee_dues", "attendance_on_date", "attendance_report"]);

const THINKING = ["Understanding your question…", "Searching the records…", "Crunching the numbers…", "Writing the answer…"];

/* ───────────────────────── Chat ───────────────────────── */

/**
 * The Ask AI page. The conversation is kept in this browser tab (per school),
 * so it survives visiting a section and coming back, but it isn't saved anywhere.
 */
export function AssistantChat({
  ask,
  model,
  schoolId,
  greeting,
}: {
  ask: (history: Message[]) => Promise<AskResult>;
  model: string;
  schoolId: string;
  greeting: string;
}) {
  const storageKey = `ask-ai:${schoolId}`;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const lastRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Restore this tab's conversation (sessionStorage may be unavailable).
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(saved) && saved.length) setMessages(saved); // eslint-disable-line react-hooks/set-state-in-effect
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    try {
      if (messages.length) sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-30)));
      else sessionStorage.removeItem(storageKey);
    } catch {}
  }, [messages, storageKey]);

  // Bring the newest question (with its answer below it) or the thinking state into view.
  useEffect(() => {
    lastRef.current?.scrollIntoView({ behavior: "smooth", block: pending ? "end" : "start" });
  }, [messages.length, pending, error]);

  function send(text: string, base = messages) {
    const question = text.trim();
    if (!question || pending) return;
    const history: Message[] = [...base, { role: "user", content: question }];
    setMessages(history);
    setInput("");
    setError(null);
    startTransition(async () => {
      try {
        const res = await ask(history.map(({ role, content }) => ({ role, content })));
        if (res.ok) setMessages([...history, { role: "assistant", content: res.content, tools: res.tools }]);
        else setError(res.error);
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  /** Asks the last question again after an error. */
  function retry() {
    const last = messages.at(-1);
    if (last?.role === "user") send(last.content, messages.slice(0, -1));
  }

  function reset() {
    setMessages([]);
    setError(null);
    setInput("");
    inputRef.current?.focus();
  }

  const started = messages.length > 0;
  const lastUser = messages.findLastIndex((m) => m.role === "user");

  return (
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            Ask AI
            <span className="rounded-full bg-gradient-to-r from-accent to-violet-500 px-2 py-0.5 text-xs font-semibold tracking-normal text-white">Beta</span>
          </span>
        }
        subtitle="Your school's records, answered in plain English or Hindi."
        action={
          started && (
            <Button variant="secondary" icon={SquarePen} onClick={reset} disabled={pending}>
              New chat
            </Button>
          )
        }
      />

      <div className="flex-1">
        {!started ? (
          <Welcome greeting={greeting} model={model} onAsk={send} />
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 pb-6">
            {messages.map((m, i) => (
              <div key={i} ref={i === (pending || error ? messages.length - 1 : lastUser) ? lastRef : undefined} className="scroll-mt-24">
                {m.role === "user" ? <UserBubble text={m.content} /> : <Answer message={m} />}
              </div>
            ))}
            {pending && (
              <div ref={lastRef}>
                <Thinking />
              </div>
            )}
            {error && !pending && (
              <div role="alert" className="ml-11 animate-rise rounded-2xl border border-danger-line bg-danger-soft p-4">
                <p className="flex items-start gap-2 text-sm text-danger">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span className="min-w-0 break-words">{error}</span>
                </p>
                {messages.at(-1)?.role === "user" && (
                  <Button variant="secondary" size="sm" icon={RotateCcw} onClick={retry} className="mt-3">
                    Try again
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <Composer
        inputRef={inputRef}
        value={input}
        onChange={setInput}
        onSend={() => send(input)}
        pending={pending}
        placeholder={started ? "Ask a follow-up…" : "Ask anything about your school…"}
      />
    </div>
  );
}

/* ───────────────────────── Pieces ───────────────────────── */

function Welcome({ greeting, model, onAsk }: { greeting: string; model: string; onAsk: (q: string) => void }) {
  return (
    <div className="space-y-6 pb-6">
      <section className="relative animate-rise overflow-hidden rounded-2xl bg-gradient-to-br from-[#5b4ee8] via-[#5a45e0] to-violet-700 p-6 text-white shadow-accent sm:p-8">
        <div aria-hidden className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden className="absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-fuchsia-400/25 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <Sparkles className="h-7 w-7" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-eyebrow uppercase text-white/75">{greeting}</p>
            <h2 className="mt-1 text-display-sm font-semibold">What would you like to know?</h2>
            <p className="mt-2 max-w-xl text-sm text-white/80">
              Ask in your own words: attendance, fees, results, staff, anything in your records. You get the answer in seconds, not after opening five pages.
            </p>
          </div>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-2 text-xs text-white/90">
          <Trust icon={Lock}>Read-only, never changes data</Trust>
          <Trust icon={ShieldCheck}>Only your school&apos;s records</Trust>
          <Trust icon={Cpu}>Open-source model · {model}</Trust>
        </div>
      </section>

      <div>
        <p className="mb-3 text-eyebrow uppercase text-muted">Try asking</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {TOPICS.map((t, i) => (
            <div
              key={t.title}
              className="animate-rise rounded-2xl border border-line bg-surface p-4 shadow-card"
              style={{ animationDelay: `${60 + i * 40}ms` }}
            >
              <div className="mb-3 flex items-center gap-3">
                <IconTile icon={t.icon} tone={t.tone} size="sm" />
                <h3 className="font-semibold text-fg">{t.title}</h3>
              </div>
              <div className="space-y-1.5">
                {t.prompts.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onAsk(p)}
                    className="group flex w-full items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-left text-sm text-fg-2 transition hover:bg-accent-soft hover:text-accent-text"
                  >
                    <span>{p}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Trust({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 ring-1 ring-white/20 backdrop-blur">
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {children}
    </span>
  );
}

function AiAvatar({ busy = false }: { busy?: boolean }) {
  return (
    <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-violet-500 text-white shadow-accent">
      {busy && <span aria-hidden className="absolute inset-0 animate-ping rounded-xl bg-accent/40" />}
      <Sparkles className="relative h-4 w-4" aria-hidden />
    </span>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex animate-rise justify-end">
      <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm text-accent-fg shadow-accent">{text}</p>
    </div>
  );
}

function Answer({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);
  const tools = [...new Set(message.tools ?? [])].filter((t) => TOOL_INFO[t]);
  const sources = [...new Map(tools.map((t) => [TOOL_INFO[t].label, TOOL_INFO[t]])).values()];
  const links = [...new Map(tools.map((t) => [TOOL_INFO[t].href, TOOL_INFO[t]])).values()].slice(0, 3);
  const notice = tools.some((t) => NOTICE_AFTER.has(t));

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="flex animate-rise gap-3">
      <AiAvatar />
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-line bg-surface p-4 shadow-card sm:p-5">
        <Markdown text={message.content} />

        {sources.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
            <span className="mr-1 text-xs text-subtle">Looked up</span>
            {sources.map((s) => (
              <span key={s.label} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted ring-1 ring-inset ring-line">
                <s.icon className="h-3 w-3" aria-hidden />
                {s.label}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1">
          <ActionButton onClick={copy} icon={copied ? Check : Copy}>
            {copied ? "Copied" : "Copy"}
          </ActionButton>
          {links.map((l) => (
            <ActionLink key={l.href} href={l.href} icon={ArrowRight}>
              Open {l.section}
            </ActionLink>
          ))}
          {notice && (
            <ActionLink href="/admin/notices" icon={Megaphone}>
              Send a notice
            </ActionLink>
          )}
        </div>
      </div>
    </div>
  );
}

const actionClass =
  "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted transition hover:bg-surface-3 hover:text-fg [&_svg]:h-3.5 [&_svg]:w-3.5";

function ActionButton({ onClick, icon: Icon, children }: { onClick: () => void; icon: ComponentType; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={actionClass}>
      <Icon />
      {children}
    </button>
  );
}

function ActionLink({ href, icon: Icon, children }: { href: string; icon: ComponentType; children: React.ReactNode }) {
  return (
    <Link href={href} className={cx(actionClass, "text-accent-text hover:bg-accent-soft hover:text-accent-text")}>
      {children}
      <Icon />
    </Link>
  );
}

function Thinking() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, THINKING.length - 1)), 2200);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex animate-rise gap-3" aria-live="polite">
      <AiAvatar busy />
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-line bg-surface p-4 shadow-card sm:p-5">
        <p key={step} className="animate-fade-in text-sm font-medium text-accent-text">
          {THINKING[step]}
        </p>
        <div className="mt-3 space-y-2" aria-hidden>
          <div className="skeleton h-3 w-11/12" />
          <div className="skeleton h-3 w-4/5" />
          <div className="skeleton h-3 w-3/5" />
        </div>
      </div>
    </div>
  );
}

function Composer({
  inputRef,
  value,
  onChange,
  onSend,
  pending,
  placeholder,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  pending: boolean;
  placeholder: string;
}) {
  const ready = !!value.trim() && !pending;
  return (
    <form
      // Floats above the phone tab bar; sits near the bottom of the window on larger screens.
      className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 mx-auto w-full max-w-3xl md:bottom-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
    >
      <div aria-hidden className="pointer-events-none absolute -inset-x-4 -bottom-6 -top-8 -z-10 bg-gradient-to-t from-canvas via-canvas/90 to-transparent" />
      <div className="rounded-2xl border border-line-strong bg-surface p-2 shadow-pop transition focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                onSend();
              }
            }}
            rows={1}
            maxLength={1000}
            placeholder={placeholder}
            aria-label="Your question"
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none [field-sizing:content]"
          />
          <button
            type="submit"
            disabled={!ready}
            aria-label="Ask"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-violet-500 text-white shadow-accent transition hover:-translate-y-px active:scale-95 disabled:translate-y-0 disabled:from-surface-3 disabled:to-surface-3 disabled:text-subtle disabled:shadow-none"
          >
            {pending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <ArrowUp className="h-5 w-5" />}
          </button>
        </div>
      </div>
      <p className="mt-2 hidden justify-between px-1 text-xs text-subtle sm:flex">
        <span>
          <kbd className="font-sans font-medium">Enter</kbd> to ask · <kbd className="font-sans font-medium">Shift + Enter</kbd> for a new line
        </span>
        <span>{value.length > 800 ? `${value.length}/1000` : "AI can make mistakes. Check important figures."}</span>
      </p>
    </form>
  );
}
