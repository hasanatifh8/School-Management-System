"use server";

import { z } from "zod";
import { assistantConfig, ModelError } from "@/lib/assistant/llm";
import { answer } from "@/lib/assistant/run";
import { getCurrentSchool } from "@/lib/school";

const historySchema = z
  .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(8000) }))
  .min(1)
  .refine((h) => h.at(-1)!.role === "user" && h.at(-1)!.content.length <= 1000, "Ask a question of up to 1000 characters.");

export type AskResult = { ok: true; content: string; tools: string[] } | { ok: false; error: string };

/** Answers the latest question in the conversation. Full admins and Power Admin only. */
export async function askAssistant(history: unknown): Promise<AskResult> {
  const school = await getCurrentSchool();
  const config = assistantConfig();
  if (!config) return { ok: false, error: "The AI assistant isn't set up. Set AI_BASE_URL and AI_MODEL on the server." };
  const parsed = historySchema.safeParse(history);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid question." };
  try {
    // Only the recent conversation is sent, to keep within the model's context.
    return { ok: true, ...(await answer(config, school, parsed.data.slice(-10))) };
  } catch (e) {
    if (e instanceof ModelError) return { ok: false, error: e.message };
    console.error("Assistant failed", e);
    return { ok: false, error: "Something went wrong while answering. Please try again." };
  }
}
