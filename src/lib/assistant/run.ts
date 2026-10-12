import "server-only";
import { todayISO } from "@/lib/attendance-shared";
import { getCurrentSession } from "@/lib/sessions";
import { chat, ModelError, type AssistantConfig, type ChatMessage } from "./llm";
import { APP_PAGES } from "./pages";
import { runTool, TOOL_SPECS } from "./tools";

export type Turn = { role: "user" | "assistant"; content: string };

const MAX_ROUNDS = 6; // tool-call rounds per question
const DEADLINE_MS = 55_000; // stay inside the page's maxDuration

// Every page that needs no record picked first, one per line.
const MAIN_PAGES = APP_PAGES.filter((p) => !p.path.includes(":"))
  .map((p) => `${p.title}: ${p.path}`)
  .join("\n");

function systemPrompt(school: { name: string }, session: { name: string }, today: string) {
  const weekday = new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" }).format(new Date());
  return `You are the data assistant for the admin of ${school.name}, a school in India, inside its school management system.
Today is ${weekday}, ${today}. The current academic session is ${session.name}.

How to answer:
- Answer questions about the school's data by calling the tools. Never make up names, numbers, dates or pages; if the tools don't return it, say you couldn't find it.
- Use the figures exactly as the tools return them. Totals and counts come from the tool ("total", "waiting", "onLeave"…); don't count or add up rows yourself when a total is given.
- Call as many tools as you need. If a tool returns "multipleMatches", ask the admin which one they mean. If it returns an error with options, retry with a valid option.
- Say what a figure covers when it matters: the date or date range, the session, and whether it counts only published results.

Finding your way in the app:
- For any "how do I…", "where is…", "kaise/kahan" question, call find_page and answer with the page link and the steps it gives, without adding steps of your own. Never invent a page or a menu.
- Call pages only by their names in the app (Fee desk, Leave, Marks & results…), as find_page returns them.
- Link to what you mention: tools return links ("link", "links", "pageLink", "reportLink", "collectLink", "resultsLink"), and the main pages are listed below. Write them as Markdown links, e.g. [Aarav Gupta](/admin/students/abc) or [Open Fee desk](/admin/fee-desk). Use only those links, exactly as given, and make the link text name the page it opens.
- After answering a data question, add one short line with the most useful next step and its link (e.g. collect the dues on the Fee desk, open the Performance report, approve pending leave).
- You can only read data. If asked to add, change, delete or send something, call find_page and say where and how to do it.

Writing:
- Reply in the admin's language (English or Hindi/Hinglish), short and to the point. Use Markdown: **bold** for key figures, bullet lists, and tables for lists of people.
- Money is in Indian rupees: write ₹1,25,000 (Indian digit grouping). Dates like 5 Sept 2026. Percentages to one decimal.
- When a list was cut short ("shown" < "total"), give the total and mention that only some are listed.

Main pages (name: link):
${MAIN_PAGES}`;
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
