import { Sparkles } from "lucide-react";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { Card, PageHeader } from "@/components/ui";
import { assistantConfig } from "@/lib/assistant/llm";
import { getCurrentSchool, getViewer } from "@/lib/school";
import { askAssistant } from "./actions";

/** "Good morning, Priya" by the time of day in India. */
function greeting(name: string | null) {
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(new Date()));
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name}` : part;
}

export default async function AssistantPage() {
  const school = await getCurrentSchool();
  const viewer = await getViewer();
  const config = assistantConfig();

  if (!config) {
    return (
      <>
        <PageHeader title="Ask AI" subtitle="Ask questions about your school in plain English or Hindi. The assistant looks up the answer in your records." />
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
      </>
    );
  }

  const firstName = viewer?.kind === "admin" ? viewer.admin.name.split(/\s+/)[0] : null;
  // Show the model's own name, e.g. "gpt-oss-120b" rather than "openai/gpt-oss-120b".
  const model = config.model.split("/").pop()!;
  return <AssistantChat ask={askAssistant} model={model} schoolId={school.id} greeting={greeting(firstName)} />;
}

// Answering can take several model calls.
export const maxDuration = 60;
