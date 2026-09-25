import "server-only";
import type { Channel } from "./providers";

export type SendResult = { ok: true; ref?: string } | { ok: false; error: string };
type Config = Record<string, string>;

/* ───────────────────────── Sending ───────────────────────── */

const TIMEOUT_MS = 15_000;

async function request(url: string, init: RequestInit): Promise<SendResult & { json?: unknown }> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    return { ok: true, json };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

const fill = (template: string, phone10: string, message: string, escape: (s: string) => string) =>
  template.replaceAll("{phone10}", escape(phone10)).replaceAll("{phone}", escape(`91${phone10}`)).replaceAll("{message}", escape(message));

/** Sends one message to an Indian mobile number (10 digits). */
export async function sendMessage(provider: string, config: Config, channel: Channel, phone10: string, message: string): Promise<SendResult> {
  switch (provider) {
    case "test":
      return { ok: true, ref: `test-${Date.now().toString(36)}` };

    case "meta": {
      const body = config.template
        ? {
            messaging_product: "whatsapp",
            to: `91${phone10}`,
            type: "template",
            template: { name: config.template, language: { code: config.language || "en" }, components: [{ type: "body", parameters: [{ type: "text", text: message.replace(/\s*\n\s*/g, " ") }] }] },
          }
        : { messaging_product: "whatsapp", to: `91${phone10}`, type: "text", text: { body: message } };
      const r = await request(`https://graph.facebook.com/v21.0/${encodeURIComponent(config.phoneNumberId)}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) return r;
      return { ok: true, ref: (r.json as { messages?: { id?: string }[] })?.messages?.[0]?.id };
    }

    case "twilio": {
      const from = channel === "WHATSAPP" ? `whatsapp:${config.from}` : config.from;
      const to = channel === "WHATSAPP" ? `whatsapp:+91${phone10}` : `+91${phone10}`;
      const r = await request(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ From: from, To: to, Body: message }),
      });
      if (!r.ok) return r;
      return { ok: true, ref: (r.json as { sid?: string })?.sid };
    }

    case "fast2sms": {
      const r = await request("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: { authorization: config.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ route: "q", message, numbers: phone10, flash: "0" }),
      });
      if (!r.ok) return r;
      const j = r.json as { return?: boolean; request_id?: string; message?: string | string[] };
      return j?.return === false ? { ok: false, error: String(j.message ?? "Rejected by Fast2SMS") } : { ok: true, ref: j?.request_id };
    }

    case "http": {
      const url = fill(config.url ?? "", phone10, message, encodeURIComponent);
      let headers: Record<string, string> = {};
      if (config.headers?.trim()) {
        try {
          headers = JSON.parse(config.headers);
        } catch {
          return { ok: false, error: "Headers are not valid JSON" };
        }
      }
      const method = config.method === "GET" ? "GET" : "POST";
      let body: string | undefined;
      if (method === "POST" && config.body?.trim()) {
        const form = /^\s*[\w.-]+=/.test(config.body);
        body = fill(config.body, phone10, message, form ? encodeURIComponent : (s) => JSON.stringify(s).slice(1, -1));
        headers = { "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json", ...headers };
      }
      const r = await request(url, { method, headers, body });
      return r.ok ? { ok: true } : r;
    }

    default:
      return { ok: false, error: "No provider set up" };
  }
}
