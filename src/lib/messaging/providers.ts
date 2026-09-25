// WhatsApp and SMS providers (their settings fields), message templates and
// placeholders. Safe for the browser; sending lives in ./send.ts (server only).

export type Channel = "WHATSAPP" | "SMS";

export type ProviderField = {
  key: string;
  label: string;
  secret?: boolean; // shown masked, never sent back to the browser
  required?: boolean;
  placeholder?: string;
  hint?: string;
  type?: "text" | "select" | "textarea";
  options?: { value: string; label: string }[];
};

export type ProviderDef = {
  id: string;
  label: string;
  description: string;
  channels: Channel[];
  fields: ProviderField[];
};


const HTTP_FIELDS: ProviderField[] = [
  { key: "method", label: "Method", type: "select", options: [{ value: "POST", label: "POST" }, { value: "GET", label: "GET" }], required: true },
  { key: "url", label: "URL", required: true, placeholder: "https://api.example.com/send?to={phone}&text={message}", hint: "Use {phone} (91XXXXXXXXXX), {phone10} (10 digits) and {message}. In the URL they are URL-encoded." },
  { key: "headers", label: "Headers (JSON)", type: "textarea", secret: true, placeholder: '{"Authorization": "Bearer YOUR_KEY"}', hint: "Kept encrypted. Leave empty if the key is in the URL or body." },
  { key: "body", label: "Body (POST)", type: "textarea", secret: true, placeholder: '{"to": "{phone}", "message": "{message}"}', hint: "Placeholders are JSON-escaped. Content type is JSON unless the body starts with key=value." },
];

export const PROVIDERS: ProviderDef[] = [
  {
    id: "test",
    label: "Test mode",
    description: "Nothing is sent. Messages are only recorded, so you can try notices safely.",
    channels: ["WHATSAPP", "SMS"],
    fields: [],
  },
  {
    id: "meta",
    label: "WhatsApp Cloud API (Meta)",
    description: "Meta's official WhatsApp Business API. Messages to parents who haven't messaged you in the last 24 hours must use an approved template.",
    channels: ["WHATSAPP"],
    fields: [
      { key: "phoneNumberId", label: "Phone number ID", required: true, placeholder: "e.g. 1234567890", hint: "WhatsApp Manager → API setup." },
      { key: "token", label: "Access token", secret: true, required: true, hint: "A permanent system-user token." },
      { key: "template", label: "Template name", placeholder: "e.g. school_notice", hint: "An approved template with one body variable {{1}}; the notice text goes there. Leave empty to send plain text (only works within 24 hours of the parent's last message)." },
      { key: "language", label: "Template language", placeholder: "en", hint: "e.g. en, en_US, hi" },
    ],
  },
  {
    id: "twilio",
    label: "Twilio",
    description: "Twilio SMS, or WhatsApp through Twilio.",
    channels: ["WHATSAPP", "SMS"],
    fields: [
      { key: "accountSid", label: "Account SID", required: true, placeholder: "AC…" },
      { key: "authToken", label: "Auth token", secret: true, required: true },
      { key: "from", label: "From number", required: true, placeholder: "+14155238886", hint: "Your Twilio number (for WhatsApp, the WhatsApp-enabled number)." },
    ],
  },
  {
    id: "fast2sms",
    label: "Fast2SMS",
    description: "Indian bulk SMS (Quick SMS route, no DLT template needed).",
    channels: ["SMS"],
    fields: [{ key: "apiKey", label: "API key", secret: true, required: true, hint: "Fast2SMS → Dev API." }],
  },
  {
    id: "http",
    label: "Other provider (HTTP)",
    description: "Any WhatsApp or SMS provider with an HTTP API (MSG91, Gupshup, Interakt, WATI, Textlocal…).",
    channels: ["WHATSAPP", "SMS"],
    fields: HTTP_FIELDS,
  },
];

export const providersFor = (channel: Channel) => PROVIDERS.filter((p) => p.channels.includes(channel));
export const providerById = (id: string | null | undefined) => PROVIDERS.find((p) => p.id === id);

/* ───────────────────────── Message text ───────────────────────── */

export const PLACEHOLDERS = [
  { token: "{student}", label: "Student name" },
  { token: "{class}", label: "Class" },
  { token: "{roll}", label: "Roll no." },
  { token: "{father}", label: "Father's name" },
  { token: "{date}", label: "Today's date" },
  { token: "{school}", label: "School name" },
];

export function personalize(text: string, v: { student: string; class: string; roll: string; father: string; date: string; school: string }) {
  return text
    .replaceAll("{student}", v.student)
    .replaceAll("{class}", v.class)
    .replaceAll("{roll}", v.roll)
    .replaceAll("{father}", v.father || "Parent")
    .replaceAll("{date}", v.date)
    .replaceAll("{school}", v.school);
}

/** SMS parts: 160 characters each (153 when split), or 70/67 with Hindi or other non-Latin text. */
export function smsParts(text: string) {
  const unicode = /[^\x00-\x7F₹]/.test(text);
  const [single, multi] = unicode ? [70, 67] : [160, 153];
  return text.length <= single ? 1 : Math.ceil(text.length / multi);
}

export const TEMPLATES: { id: string; label: string; title: string; body: string }[] = [
  { id: "absent", label: "Absent today", title: "Absence alert", body: "Dear {father}, {student} of {class} was absent from school today ({date}). Please send a leave note if you haven't already. – {school}" },
  { id: "holiday", label: "Holiday", title: "Holiday notice", body: "Dear Parent, the school will remain closed on <date> for <reason>. Classes resume on <date>. – {school}" },
  { id: "fees", label: "Fee reminder", title: "Fee reminder", body: "Dear {father}, this is a reminder that {student}'s ({class}) fee for this month is due. Please pay at the school office. Ignore if already paid. – {school}" },
  { id: "ptm", label: "Parent-teacher meeting", title: "Parent-teacher meeting", body: "Dear Parent, a parent-teacher meeting for {class} is on <date> at <time>. Please attend to discuss {student}'s progress. – {school}" },
  { id: "general", label: "General", title: "", body: "Dear Parent, " },
];
