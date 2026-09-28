import "server-only";
import { todayISO } from "@/lib/attendance-shared";
import { getCurrentSession } from "@/lib/sessions";
import { chat, ModelError, type AssistantConfig, type ChatMessage } from "./llm";
import { runTool, TOOL_SPECS } from "./tools";

export type Turn = { role: "user" | "assistant"; content: string };

const MAX_ROUNDS = 6; // tool-call rounds per question
const DEADLINE_MS = 55_000; // stay inside the page's maxDuration

function systemPrompt(school: { name: string }, session: { name: string }, today: string) {
  const weekday = new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" }).format(new Date());
  return `You are the data assistant for the admin of ${school.name}, a school in India, inside its school management system.
Today is ${weekday}, ${today}. The current academic session is ${session.name}.

How to answer:
- Answer questions about the school's data by calling the tools. Never make up names, numbers or dates; if the tools don't return it, say you couldn't find it.
- Call as many tools as you need. If a tool returns "multipleMatches", ask the admin which one they mean. If it returns an error with options, retry with a valid option.
- You can only read data. If asked to add, change, delete or send something, say which section of the app to use (e.g. Students, Fees, Attendance, Notices).
- Reply in the admin's language (English or Hindi/Hinglish), short and to the point. Use Markdown: **bold** for key figures, bullet lists, and tables for lists of people.
- Money is in Indian rupees: write ₹1,25,000 (Indian digit grouping). Dates like 5 Sept 2026.
- When a list was cut short ("shown" < "total"), give the total and mention that only some are listed.`;
}

/** Answers the admin's latest question, calling data tools as the model requests. */
export async function answer(config: AssistantConfig, school: { id: string; name: string }, history: Turn[]) {
  const today = todayISO();
  const session = await getCurrentSession(school.id);
  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt(school, session, today) }, ...history];
  const ctx = { schoolId: school.id, today };
  const signal = AbortSignal.timeout(DEADLINE_MS);
  const used: string[] = [];

  for (let round = 0; round <= MAX_ROUNDS; round++) {
    // On the last round, withhold tools so the model has to answer.
    const reply = await chat(config, messages, round < MAX_ROUNDS ? TOOL_SPECS : [], signal);
    if (!reply.toolCalls.length) {
      if (!reply.content) throw new ModelError("The AI model didn't give an answer. Try asking differently.");
      return { content: reply.content, tools: used };
    }
    messages.push({ role: "assistant", content: reply.content || null, tool_calls: reply.toolCalls });
    for (const call of reply.toolCalls) {
      used.push(call.function.name);
      messages.push({ role: "tool", tool_call_id: call.id, content: await runTool(ctx, call.function.name, call.function.arguments) });
    }
  }
  throw new ModelError("The question needed too many lookups. Try asking something more specific.");
}
