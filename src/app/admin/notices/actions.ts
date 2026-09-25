"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { getActor } from "@/lib/access";
import { parseISODate, todayISO } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { providerById, type Channel } from "@/lib/messaging/providers";
import { sendMessage } from "@/lib/messaging/send";
import { CHANNEL_LABELS, createNotice, loadMessaging, noticeCounts, previewAudience, sendForAWhile, sendNextBatch, type AudienceSpec } from "@/lib/messaging/server";
import { fullName } from "@/lib/queries";
import { getCurrentSchool, getViewer } from "@/lib/school";
import { canEncrypt, decrypt, encrypt } from "@/lib/secrets";
import { normalizeIndianMobile } from "@/lib/student-options";

const CHANNELS = ["WHATSAPP", "SMS"] as const;

/* ───────────────────────── Settings (admins) ───────────────────────── */

export async function saveChannelSettings(channel: Channel, _: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const provider = String(formData.get("provider") ?? "");
  const def = providerById(provider);
  if (!def || !def.channels.includes(channel)) return { error: "Choose a provider." };

  const existing = await db.messagingSettings.findUnique({ where: { schoolId: school.id } });
  const storedField = channel === "WHATSAPP" ? existing?.whatsappConfig : existing?.smsConfig;
  const sameProvider = (channel === "WHATSAPP" ? existing?.whatsappProvider : existing?.smsProvider) === provider;
  const previous: Record<string, string> = sameProvider && storedField ? JSON.parse(decrypt(storedField) ?? "{}") : {};

  const config: Record<string, string> = {};
  const fieldErrors: Record<string, string[]> = {};
  for (const f of def.fields) {
    let value = String(formData.get(f.key) ?? "").trim();
    if (f.secret && !value && previous[f.key]) value = previous[f.key]; // blank = keep the saved secret
    if (f.required && !value) fieldErrors[f.key] = [`${f.label} is required`];
    if (value) config[f.key] = value;
  }
  if (provider === "http") {
    if (config.url && !/^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)[:/])/.test(config.url)) fieldErrors.url = ["Use an https:// address"];
    if (config.headers) {
      try {
        JSON.parse(config.headers);
      } catch {
        fieldErrors.headers = ["Must be valid JSON"];
      }
    }
  }
  if (Object.keys(fieldErrors).length) return { error: "Please fix the highlighted fields.", fieldErrors };
  if (def.fields.length && !canEncrypt()) {
    return { error: "The server has no SECRETS_KEY, so API keys can't be stored safely. Add SECRETS_KEY (any long random text) to the environment and try again." };
  }

  const stored = def.fields.length ? encrypt(JSON.stringify(config)) : null;
  const data = channel === "WHATSAPP" ? { whatsappProvider: provider, whatsappConfig: stored } : { smsProvider: provider, smsConfig: stored };
  await db.messagingSettings.upsert({ where: { schoolId: school.id }, create: { schoolId: school.id, ...data }, update: data });
  revalidatePath("/admin/notices", "layout");
  return { ok: true, message: `${CHANNEL_LABELS[channel]} is set up with ${def.label}.` };
}

export async function turnOffChannel(channel: Channel): Promise<ActionState> {
  const school = await getCurrentSchool();
  const data = channel === "WHATSAPP" ? { whatsappProvider: null, whatsappConfig: null } : { smsProvider: null, smsConfig: null };
  await db.messagingSettings.upsert({ where: { schoolId: school.id }, create: { schoolId: school.id }, update: data });
  revalidatePath("/admin/notices", "layout");
  return { ok: true, message: `${CHANNEL_LABELS[channel]} turned off and its settings removed.` };
}

export async function setTeachersCanSend(allowed: boolean): Promise<ActionState> {
  const school = await getCurrentSchool();
  await db.messagingSettings.upsert({ where: { schoolId: school.id }, create: { schoolId: school.id, teachersCanSend: allowed }, update: { teachersCanSend: allowed } });
  revalidatePath("/", "layout");
  return { ok: true, message: allowed ? "Class teachers can send notices to their class." : "Only admins can send notices now." };
}

export async function sendTestMessage(channel: Channel, _: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const phone = normalizeIndianMobile(String(formData.get("phone") ?? ""));
  if (!phone) return { error: "Enter a 10-digit mobile number.", fieldErrors: { phone: ["Enter a valid mobile number"] } };
  const setup = (await loadMessaging(school.id))[channel];
  if (!setup.ready || !setup.provider) return { error: setup.problem ?? `Set up ${CHANNEL_LABELS[channel]} first.` };
  const result = await sendMessage(setup.provider, setup.config ?? {}, channel, phone, `Test message from ${school.name}. If you received this, ${CHANNEL_LABELS[channel]} notices are working.`);
  return result.ok
    ? { ok: true, message: setup.provider === "test" ? "Test mode: recorded, nothing was actually sent." : `Sent to ${phone}. Check the phone.` }
    : { error: `The provider said: ${result.error}` };
}

/* ───────────────────────── Sending (admins and class teachers) ───────────────────────── */

/** Who is sending and what they may send to. */
async function sender() {
  const actor = await getActor();
  if (actor.kind === "staff") {
    const viewer = await getViewer();
    return { school: actor.school, sentBy: viewer?.kind === "admin" ? viewer.admin.name : "Power Admin", teacherId: undefined, onlySectionId: undefined, base: "/admin/notices" };
  }
  const { ctx } = actor;
  if (!ctx.classSection) return { error: "Only class teachers can send notices." } as const;
  const messaging = await loadMessaging(ctx.school.id);
  if (!messaging.teachersCanSend) return { error: "The school admin has turned off notices from teachers." } as const;
  return { school: ctx.school, sentBy: `${fullName(ctx.teacher)} (class teacher)`, teacherId: ctx.teacher.id, onlySectionId: ctx.classSection.id, base: "/teacher/notices" };
}

const noticeSchema = z.object({
  audience: z.enum(["classes", "students", "absent", "school"]),
  title: z.string().trim().min(2, "Give the notice a short title").max(100),
  body: z.string().trim().min(5, "Write the message").max(1000, "Keep it under 1000 characters"),
});

function readNotice(formData: FormData) {
  const parsed = noticeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const e = z.flattenError(parsed.error).fieldErrors;
    return { error: Object.values(e).flat()[0] ?? "Check the form", fieldErrors: e as Record<string, string[]> };
  }
  const channels = formData.getAll("channels").filter((c): c is Channel => CHANNELS.includes(c as Channel));
  if (!channels.length) return { error: "Choose WhatsApp, SMS or both.", fieldErrors: { channels: ["Choose at least one"] } };
  const ids = (name: string) => formData.getAll(name).map(String).filter(Boolean);
  const { audience } = parsed.data;
  let spec: AudienceSpec;
  if (audience === "classes") {
    if (!ids("sectionIds").length) return { error: "Choose at least one class.", fieldErrors: { sectionIds: ["Choose at least one class"] } };
    spec = { type: "classes", sectionIds: ids("sectionIds") };
  } else if (audience === "students") {
    if (!ids("studentIds").length) return { error: "Choose at least one student.", fieldErrors: { studentIds: ["Choose at least one student"] } };
    spec = { type: "students", studentIds: ids("studentIds") };
  } else if (audience === "absent") {
    const date = String(formData.get("date") ?? todayISO());
    if (!parseISODate(date) || date > todayISO()) return { error: "Choose a date up to today.", fieldErrors: { date: ["Up to today"] } };
    spec = { type: "absent", date, sectionIds: ids("absentSectionIds") };
  } else spec = { type: "school" };
  return { spec, channels, title: parsed.data.title, body: parsed.data.body };
}

export type NoticePreview = ActionState & { preview?: Awaited<ReturnType<typeof previewAudience>> };

export async function previewNotice(_: NoticePreview, formData: FormData): Promise<NoticePreview> {
  const s = await sender();
  if ("error" in s) return { error: s.error };
  const input = readNotice(formData);
  if ("error" in input) return { error: input.error, fieldErrors: input.fieldErrors };
  const messaging = await loadMessaging(s.school.id);
  const off = input.channels.filter((c) => !messaging[c].ready);
  if (off.length) return { error: `${off.map((c) => CHANNEL_LABELS[c]).join(" and ")} ${off.length > 1 ? "are" : "is"} not set up. An admin can set it up under Notices → Settings.` };
  const preview = await previewAudience(s.school.id, s.school.name, input.spec, input.channels, input.body, s.onlySectionId);
  if (!preview.students) return { error: "No students match. Nothing would be sent." };
  return { ok: true, preview };
}

export async function sendNotice(_: ActionState, formData: FormData): Promise<ActionState> {
  const s = await sender();
  if ("error" in s) return { error: s.error };
  const input = readNotice(formData);
  if ("error" in input) return { error: input.error, fieldErrors: input.fieldErrors };
  const messaging = await loadMessaging(s.school.id);
  if (input.channels.some((c) => !messaging[c].ready)) return { error: "A chosen channel is not set up." };
  const notice = await createNotice({ schoolId: s.school.id, schoolName: s.school.name, ...input, sentBy: s.sentBy, teacherId: s.teacherId, onlySectionId: s.onlySectionId });
  // Keep sending after the response, even if the page is closed.
  after(() => sendForAWhile(s.school.id, notice.id));
  revalidatePath(s.base);
  redirect(`${s.base}/${notice.id}`);
}

/** A notice the current user may manage: admins any in the school, teachers their own. */
async function ownNotice(noticeId: string) {
  const actor = await getActor();
  const school = actor.kind === "staff" ? actor.school : actor.ctx.school;
  return db.notice.findFirst({
    where: { id: noticeId, schoolId: school.id, ...(actor.kind === "teacher" && { teacherId: actor.ctx.teacher.id }) },
    select: { id: true, schoolId: true },
  });
}

/** Sends the next batch; the notice page calls this until nothing is pending. */
export async function processNotice(noticeId: string) {
  const notice = await ownNotice(noticeId);
  if (!notice) return null;
  return sendNextBatch(notice.schoolId, notice.id);
}

export async function retryFailed(noticeId: string): Promise<ActionState> {
  const notice = await ownNotice(noticeId);
  if (!notice) return { error: "Notice not found." };
  const { count } = await db.noticeRecipient.updateMany({ where: { noticeId, status: "FAILED" }, data: { status: "PENDING", error: null, providerRef: null } });
  if (count) after(() => sendForAWhile(notice.schoolId, notice.id));
  revalidatePath("/", "layout");
  return count ? { ok: true, message: `Retrying ${count} message(s)…` } : { error: "Nothing failed." };
}

export async function getNoticeCounts(noticeId: string) {
  const notice = await ownNotice(noticeId);
  return notice ? noticeCounts(notice.id) : null;
}
