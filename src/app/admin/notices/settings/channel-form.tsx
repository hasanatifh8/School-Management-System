"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { inputClass, selectClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { providersFor, type Channel } from "@/lib/messaging/providers";

/** Choose a provider for WhatsApp or SMS and fill in its settings. Saved secrets are never shown. */
export function ChannelForm({
  channel,
  current,
  action,
}: {
  channel: Channel;
  current: { provider: string | null; values: Record<string, string>; savedSecrets: string[] };
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
}) {
  const options = providersFor(channel);
  const [provider, setProvider] = useState(current.provider ?? "");
  const def = options.find((p) => p.id === provider);
  const same = provider === current.provider;
  return (
    <ActionForm action={action} className="space-y-4">
      {(state) => (
        <>
          <Field label="Provider" name="provider" errors={state.fieldErrors}>
            <select name="provider" value={provider} onChange={(e) => setProvider(e.target.value)} className={selectClass}>
              <option value="">Choose…</option>
              {options.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          {def && <p className="text-xs text-slate-500">{def.description}</p>}
          {def?.fields.map((f) => {
            const saved = same && f.secret && current.savedSecrets.includes(f.key);
            const common = {
              name: f.key,
              defaultValue: same && !f.secret ? (current.values[f.key] ?? "") : "",
              placeholder: saved ? "Saved. Leave empty to keep it" : f.placeholder,
              className: inputClass,
              autoComplete: "off",
            };
            return (
              <Field key={`${provider}-${f.key}`} label={f.label} name={f.key} errors={state.fieldErrors} required={f.required && !saved} hint={f.hint}>
                {f.type === "select" ? (
                  <select {...common} className={selectClass}>
                    {f.options!.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea {...common} rows={3} className={`${inputClass} font-mono text-xs`} />
                ) : (
                  <input {...common} type={f.secret ? "password" : "text"} />
                )}
              </Field>
            );
          })}
          <SubmitButton icon={<Save className="h-4 w-4" />}>Save</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
