import "server-only";

/**
 * Client for the admin assistant's language model. It speaks the OpenAI-style
 * `/chat/completions` API with tool calling, which open-source model servers
 * share: Ollama and vLLM (self-hosted), or hosted open models on Groq,
 * OpenRouter, Together and others.
 *
 *   AI_BASE_URL  e.g. http://localhost:11434/v1 (Ollama) or https://api.groq.com/openai/v1
 *   AI_MODEL     e.g. qwen2.5:7b (Ollama) or openai/gpt-oss-120b (Groq)
 *   AI_API_KEY   only for hosted providers
 *
 * In development the assistant falls back to a local Ollama with qwen2.5:7b.
 * In production it stays off until AI_BASE_URL and AI_MODEL are set.
 */
export type AssistantConfig = { baseUrl: string; model: string; apiKey: string | null };

export function assistantConfig(): AssistantConfig | null {
  const dev = process.env.NODE_ENV !== "production";
  const baseUrl = process.env.AI_BASE_URL?.trim() || (dev ? "http://localhost:11434/v1" : "");
  const model = process.env.AI_MODEL?.trim() || (dev ? "qwen2.5:7b" : "");
  if (!baseUrl || !model) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), model, apiKey: process.env.AI_API_KEY?.trim() || null };
}

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolSpec = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export class ModelError extends Error {}

/** One chat completion. Returns the model's reply, which may ask for tool calls. */
export async function chat(config: AssistantConfig, messages: ChatMessage[], tools: ToolSpec[], signal: AbortSignal) {
  const res = await post(config, messages, tools, signal);
  const data = (await res.json()) as { choices?: { message?: { content?: string | null; tool_calls?: unknown[] } }[] };
  const message = data.choices?.[0]?.message;
  if (!message) throw new ModelError("The AI model sent an empty reply.");

  // Some servers send arguments as an object instead of a JSON string, or leave out ids.
  const toolCalls: ToolCall[] = (message.tool_calls ?? []).map((raw, i) => {
    const c = raw as { id?: string; function?: { name?: string; arguments?: unknown } };
    const args = c.function?.arguments;
    return {
      id: c.id || `call_${i}`,
      type: "function",
      function: { name: c.function?.name ?? "", arguments: typeof args === "string" ? args : JSON.stringify(args ?? {}) },
    };
  });
  return { content: stripThinking(message.content ?? ""), toolCalls };
}

/**
 * Sends the request, retrying twice for errors that usually pass: a malformed
 * tool call (Groq rejects these with "tool_use_failed") and rate limits with a
 * short wait (free tiers limit tokens per minute).
 */
async function post(config: AssistantConfig, messages: ChatMessage[], tools: ToolSpec[], signal: AbortSignal) {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({ model: config.model, messages, ...(tools.length ? { tools, tool_choice: "auto" } : {}), temperature: 0.1 }),
        signal,
      });
    } catch (e) {
      if (signal.aborted) throw new ModelError("The AI model took too long to answer. Try a simpler question.");
      throw new ModelError(`Couldn't reach the AI model at ${config.baseUrl}. ${e instanceof Error ? e.message : ""}`.trim());
    }
    if (res.ok) return res;

    const detail = (await res.text().catch(() => "")).slice(0, 300);
    const wait = res.status === 429 ? Number(res.headers.get("retry-after")) || 10 : 0;
    const retryable = (res.status === 400 && /tool_use_failed|tool call validation/i.test(detail)) || (res.status === 429 && wait <= 20);
    if (retryable && attempt < 2) {
      if (wait) await new Promise((r) => setTimeout(r, wait * 1000));
      if (signal.aborted) throw new ModelError("The AI model took too long to answer. Try a simpler question.");
      continue;
    }
    if (res.status === 401) throw new ModelError("The AI provider rejected the API key. Check AI_API_KEY.");
    if (res.status === 429) throw new ModelError("The AI provider's usage limit was reached. Wait a minute and ask again.");
    throw new ModelError(`The AI model returned an error (${res.status}). ${detail}`.trim());
  }
}

/** Reasoning models (Qwen 3, DeepSeek R1) may include their thinking in the reply. */
const stripThinking = (text: string) => text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
