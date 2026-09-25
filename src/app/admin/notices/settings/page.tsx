import { KeyRound, MessageCircle, MessageSquareText, Send, TriangleAlert, Users } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Badge, Card, inputClass } from "@/components/ui";
import { db } from "@/lib/db";
import { providerById, type Channel } from "@/lib/messaging/providers";
import { loadMessaging } from "@/lib/messaging/server";
import { getCurrentSchool } from "@/lib/school";
import { canEncrypt } from "@/lib/secrets";
import { saveChannelSettings, sendTestMessage, setTeachersCanSend, turnOffChannel } from "../actions";
import { ChannelForm } from "./channel-form";

/** Connect a WhatsApp provider and a bulk-SMS provider; send a test message. */
export default async function MessagingSettingsPage() {
  const school = await getCurrentSchool();
  const [messaging, settings] = await Promise.all([loadMessaging(school.id), db.messagingSettings.findUnique({ where: { schoolId: school.id } })]);

  const card = (channel: Channel, title: string, Icon: typeof MessageCircle) => {
    const setup = messaging[channel];
    const def = providerById(setup.provider);
    const values = setup.config ?? {};
    const secretKeys = new Set(def?.fields.filter((f) => f.secret).map((f) => f.key));
    return (
      <Card
        title={title}
        icon={Icon}
        description={def ? `Using ${def.label}` : "Not set up"}
        action={setup.ready ? <Badge tone="green" dot>Ready</Badge> : setup.provider ? <Badge tone="red" dot>Needs attention</Badge> : <Badge>Off</Badge>}
      >
        {setup.problem && (
          <p className="mb-4 flex gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {setup.problem}
          </p>
        )}
        <ChannelForm
          channel={channel}
          action={saveChannelSettings.bind(null, channel)}
          current={{
            provider: setup.provider,
            values: Object.fromEntries(Object.entries(values).filter(([k]) => !secretKeys.has(k))),
            savedSecrets: Object.keys(values).filter((k) => secretKeys.has(k)),
          }}
        />
        {setup.ready && (
          <div className="mt-6 space-y-3 border-t border-slate-100 pt-5">
            <ActionForm action={sendTestMessage.bind(null, channel)} className="space-y-2">
              <Field label="Send a test message to" name="phone">
                <div className="flex gap-2">
                  <input name="phone" type="tel" placeholder="10-digit mobile" className={`${inputClass} max-w-52`} />
                  <SubmitButton variant="secondary" size="sm" icon={<Send className="h-4 w-4" />}>
                    Send test
                  </SubmitButton>
                </div>
              </Field>
            </ActionForm>
            <ActionForm action={turnOffChannel.bind(null, channel)} compact className="flex items-center gap-3">
              <SubmitButton variant="dangerGhost" size="sm" confirm={`Turn off ${title} and remove its saved settings?`}>
                Turn off {title}
              </SubmitButton>
            </ActionForm>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {!canEncrypt() && (
        <p className="flex gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>SECRETS_KEY is not set on the server.</strong> API keys are stored encrypted with it. Add an environment variable <code className="font-mono">SECRETS_KEY</code> (any long random text, e.g. 40 characters) and redeploy. Until then only Test mode can be used.
          </span>
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        {card("WHATSAPP", "WhatsApp", MessageCircle)}
        {card("SMS", "SMS", MessageSquareText)}
      </div>
      <Card title="Class teachers" icon={Users} description="Whether class teachers can send notices to their own class's parents.">
        <ActionForm action={setTeachersCanSend.bind(null, !(settings?.teachersCanSend ?? true))} compact className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-700">{settings?.teachersCanSend ?? true ? "Allowed" : "Not allowed"}</span>
          <SubmitButton variant="secondary" size="sm">
            {settings?.teachersCanSend ?? true ? "Stop teachers sending" : "Allow teachers to send"}
          </SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
