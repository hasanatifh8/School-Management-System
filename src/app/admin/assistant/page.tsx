import { Sparkles } from "lucide-react";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { Card, PageHeader } from "@/components/ui";
import { assistantConfig } from "@/lib/assistant/llm";
import { getCurrentSchool } from "@/lib/school";
import { askAssistant } from "./actions";

export default async function AssistantPage() {
  await getCurrentSchool();
  const config = assistantConfig();
  return (
    <>
      <PageHeader title="Ask AI" subtitle="Ask questions about your school in plain English or Hindi. The assistant looks up the answer in your records." />
      {config ? (
        <AssistantChat ask={askAssistant} model={config.model} />
      ) : (
        <Card title="The AI assistant isn't set up" icon={Sparkles}>
          <div className="space-y-2 text-sm text-fg-2">
            <p>It runs on an open-source model of your choice. Set these environment variables on the server and redeploy:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <code>AI_BASE_URL</code>: an OpenAI-compatible endpoint, e.g. your own Ollama/vLLM server or a host of open models such as Groq or OpenRouter
              </li>
              <li>
                <code>AI_MODEL</code>: the model, e.g. <code>qwen2.5:7b</code> or <code>openai/gpt-oss-120b</code>
              </li>
              <li>
                <code>AI_API_KEY</code>: only needed for hosted providers
              </li>
            </ul>
          </div>
        </Card>
      )}
    </>
  );
}

// Answering can take several model calls.
export const maxDuration = 60;
