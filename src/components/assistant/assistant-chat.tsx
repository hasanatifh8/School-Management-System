"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp, RotateCcw, Sparkles, TriangleAlert } from "lucide-react";
import { Button, IconButton } from "@/components/ui";
import type { AskResult } from "@/app/admin/assistant/actions";
import { Markdown } from "./markdown";

type Message = { role: "user" | "assistant"; content: string; tools?: string[] };

const SUGGESTIONS = [
  "How many students are there in each class?",
  "Who was absent today?",
  "Which students have the highest pending fees?",
  "How much fee was collected this month, by payment mode?",
  "Students with attendance below 75% this session",
  "Expenses this month compared to budget",
  "Upcoming holidays and events",
  "Who teaches Maths, and in which classes?",
];

/** Chat with the data assistant. The conversation lives in the page only (not saved). */
export function AssistantChat({ ask, model }: { ask: (history: Message[]) => Promise<AskResult>; model: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  function send(text: string) {
    const question = text.trim();
    if (!question || pending) return;
    const history = [...messages, { role: "user" as const, content: question }];
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

  function reset() {
    setMessages([]);
    setError(null);
    inputRef.current?.focus();
  }

  return (
    <div className="flex min-h-[calc(100dvh-16rem)] flex-col rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex-1 space-y-5 p-4 sm:p-6">
        {messages.length === 0 && (
          <div className="mx-auto max-w-2xl py-6 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-text">
              <Sparkles className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-fg">Ask about your school&apos;s data</h2>
            <p className="mt-1 text-sm text-muted">Students, attendance, fees, expenses, exams, timetable and calendar. The assistant can only read data, not change it.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-sm text-fg-2 transition hover:border-accent-line hover:bg-accent-soft hover:text-accent-text"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm text-accent-fg">{m.content}</p>
            </div>
          ) : (
            <div key={i} className="flex gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-text">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0 max-w-[calc(100%-2.75rem)] flex-1">
                <Markdown text={m.content} />
                {m.tools && m.tools.length > 0 && (
                  <p className="mt-2 text-xs text-subtle">Looked up: {[...new Set(m.tools)].map((t) => t.replace(/_/g, " ")).join(", ")}</p>
                )}
              </div>
            </div>
          ),
        )}

        {pending && (
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-soft text-accent-text">
              <Sparkles className="h-4 w-4 animate-pulse" />
            </span>
            Looking through the records…
          </div>
        )}

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0 break-words">{error}</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="sticky bottom-0 border-t border-line bg-surface/95 p-3 backdrop-blur sm:p-4"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className="flex items-end gap-2">
          {messages.length > 0 && <IconButton icon={RotateCcw} label="New conversation" onClick={reset} disabled={pending} />}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            maxLength={1000}
            placeholder="e.g. Which Class 8 students haven't paid fees?"
            aria-label="Your question"
            className="max-h-40 min-h-10 flex-1 resize-none rounded-xl border border-line-strong bg-surface px-3.5 py-2 text-sm text-fg placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 [field-sizing:content]"
          />
          <Button type="submit" icon={ArrowUp} loading={pending} disabled={!input.trim()} aria-label="Ask">
            <span className="hidden sm:inline">Ask</span>
          </Button>
        </div>
        <p className="mt-2 text-xs text-subtle">Answers come from an open-source AI model ({model}) and can be wrong. Check important figures in the app.</p>
      </form>
    </div>
  );
}
