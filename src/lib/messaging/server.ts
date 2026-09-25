import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { formatISO, parseISODate, shortDate, todayISO } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { fullName, sectionLabel } from "@/lib/queries";
import { canEncrypt, decrypt } from "@/lib/secrets";
import { normalizeIndianMobile } from "@/lib/student-options";
import { personalize, providerById, type Channel } from "./providers";
import { sendMessage } from "./send";

export const CHANNEL_LABELS: Record<Channel, string> = { WHATSAPP: "WhatsApp", SMS: "SMS" };

type ChannelSetup = { provider: string | null; config: Record<string, string> | null; ready: boolean; problem: string | null };

function readChannel(provider: string | null | undefined, stored: string | null | undefined): ChannelSetup {
  const def = providerById(provider);
  if (!provider || !def) return { provider: null, config: null, ready: false, problem: null };
  if (!def.fields.length) return { provider, config: {}, ready: true, problem: null };
  const json = stored ? decrypt(stored) : null;
  if (!json) {
    return {
      provider,
      config: null,
      ready: false,
      problem: canEncrypt() ? "Its saved settings can't be read (the SECRETS_KEY changed). Enter them again." : "SECRETS_KEY is not set on the server.",
    };
  }
  return { provider, config: JSON.parse(json), ready: true, problem: null };
}

/** The school's WhatsApp and SMS setup, with decrypted settings (server only). */
export async function loadMessaging(schoolId: string) {
  const s = await db.messagingSettings.findUnique({ where: { schoolId } });
  return {
    WHATSAPP: readChannel(s?.whatsappProvider, s?.whatsappConfig),
    SMS: readChannel(s?.smsProvider, s?.smsConfig),
    teachersCanSend: s?.teachersCanSend ?? true,
  };
}

/* ───────────────────────── Audience ───────────────────────── */

export type AudienceSpec =
  | { type: "classes"; sectionIds: string[] }
  | { type: "students"; studentIds: string[] }
  | { type: "absent"; date: string; sectionIds: string[] }
  | { type: "school" };

const studentSelect = {
  id: true,
  firstName: true,
  middleName: true,
  lastName: true,
  rollNumber: true,
  fatherName: true,
  phone: true,
  whatsappNumber: true,
  section: { select: { name: true, class: { select: { name: true } } } },
} as const;

/**
 * The students a notice goes to. `onlySectionId` limits it to one class
 * (a class teacher's own); anything outside it is ignored.
 */
export async function resolveAudience(schoolId: string, spec: AudienceSpec, onlySectionId?: string) {
  const base: Prisma.StudentWhereInput = { schoolId, status: "ACTIVE", ...(onlySectionId && { sectionId: onlySectionId }) };
  let where: Prisma.StudentWhereInput;
  let label: string;
  switch (spec.type) {
    case "school":
      where = { ...base, sectionId: onlySectionId ?? { not: null } };
      label = onlySectionId ? "Whole class" : "Whole school";
      break;
    case "classes": {
      const sections = await db.section.findMany({ where: { id: { in: spec.sectionIds }, class: { schoolId } }, include: { class: true } });
      where = { ...base, sectionId: { in: sections.map((s) => s.id).filter((id) => !onlySectionId || id === onlySectionId) } };
      label = sections.map(sectionLabel).join(", ") || "No class chosen";
      break;
    }
    case "students":
      where = { ...base, id: { in: spec.studentIds } };
      label = `${spec.studentIds.length} chosen student${spec.studentIds.length === 1 ? "" : "s"}`;
      break;
    case "absent": {
      const date = parseISODate(spec.date) ?? parseISODate(todayISO())!;
      const sectionFilter = onlySectionId ? [onlySectionId] : spec.sectionIds.length ? spec.sectionIds : null;
      where = {
        ...base,
        attendance: { some: { status: "ABSENT", day: { date, holiday: null, ...(sectionFilter && { sectionId: { in: sectionFilter } }) } } },
      };
      label = `Absent on ${shortDate.format(date)}`;
      break;
    }
  }
  const students = await db.student.findMany({
    where,
    select: studentSelect,
    orderBy: [{ section: { class: { sortOrder: "asc" } } }, { section: { name: "asc" } }, { rollNumber: { sort: "asc", nulls: "last" } }, { firstName: "asc" }],
  });
  return { students, label };
}

type AudienceStudent = Awaited<ReturnType<typeof resolveAudience>>["students"][number];

function recipientFor(s: AudienceStudent, channel: Channel, body: string, school: string, date: string) {
  const className = s.section ? `${s.section.class.name} – ${s.section.name}` : "";
  const raw = channel === "WHATSAPP" ? (s.whatsappNumber ?? s.phone) : s.phone;
  const phone = raw ? normalizeIndianMobile(raw) : null;
  return {
    studentId: s.id,
    name: fullName(s),
    className: className || null,
    phone,
    channel,
    message: personalize(body, { student: fullName(s), class: className, roll: s.rollNumber != null ? String(s.rollNumber) : "", father: s.fatherName ?? "", date, school }),
    status: phone ? ("PENDING" as const) : ("SKIPPED" as const),
    error: phone ? null : raw ? `Not a valid mobile number: ${raw}` : "No mobile number",
  };
}

/** How many messages a notice would send, and the first one as a sample. */
export async function previewAudience(schoolId: string, schoolName: string, spec: AudienceSpec, channels: Channel[], body: string, onlySectionId?: string) {
  const { students, label } = await resolveAudience(schoolId, spec, onlySectionId);
  const date = formatISO(todayISO(), shortDate);
  const rows = students.flatMap((s) => channels.map((c) => recipientFor(s, c, body, schoolName, date)));
  return {
    label,
    students: students.length,
    messages: rows.filter((r) => r.status === "PENDING").length,
    skipped: rows.filter((r) => r.status === "SKIPPED").length,
    sample: rows.find((r) => r.status === "PENDING") ?? rows[0] ?? null,
  };
}

/** Saves a notice with one recipient row per student per channel, ready to send. */
export async function createNotice(input: {
  schoolId: string;
  schoolName: string;
  spec: AudienceSpec;
  channels: Channel[];
  title: string;
  body: string;
  sentBy: string;
  teacherId?: string;
  onlySectionId?: string;
}) {
  const { students, label } = await resolveAudience(input.schoolId, input.spec, input.onlySectionId);
  const date = formatISO(todayISO(), shortDate);
  return db.notice.create({
    data: {
      schoolId: input.schoolId,
      title: input.title,
      body: input.body,
      channels: input.channels,
      audience: label,
      sentBy: input.sentBy,
      teacherId: input.teacherId,
      recipients: { create: students.flatMap((s) => input.channels.map((c) => recipientFor(s, c, input.body, input.schoolName, date))) },
    },
  });
}

/* ───────────────────────── Delivery ───────────────────────── */

const BATCH = 25;
const PARALLEL = 5;

/**
 * Sends the next batch of pending messages for a notice. Returns what is left.
 * Rows are claimed first (FOR UPDATE SKIP LOCKED), so the background sender and
 * an open notice page can run at the same time without sending anything twice.
 * A claim older than 2 minutes (a sender that died) can be taken over.
 */
export async function sendNextBatch(schoolId: string, noticeId: string) {
  const messaging = await loadMessaging(schoolId);
  const pending = await db.$queryRaw<{ id: string; channel: Channel; phone: string | null; message: string }[]>`
    UPDATE "NoticeRecipient" SET "providerRef" = 'claimed', "sentAt" = now()
    WHERE id IN (
      SELECT id FROM "NoticeRecipient"
      WHERE "noticeId" = ${noticeId} AND status = 'PENDING'
        AND ("providerRef" IS NULL OR "sentAt" < now() - interval '2 minutes')
      ORDER BY id LIMIT ${BATCH}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, channel, phone, message`;

  for (let i = 0; i < pending.length; i += PARALLEL) {
    await Promise.all(
      pending.slice(i, i + PARALLEL).map(async (r) => {
        const setup = messaging[r.channel];
        const result =
          setup.ready && setup.provider && r.phone
            ? await sendMessage(setup.provider, setup.config ?? {}, r.channel, r.phone, r.message)
            : { ok: false as const, error: setup.problem ?? `${CHANNEL_LABELS[r.channel]} is not set up` };
        await db.noticeRecipient.update({
          where: { id: r.id },
          data: result.ok ? { status: "SENT", providerRef: result.ref ?? null, error: null, sentAt: new Date() } : { status: "FAILED", error: result.error.slice(0, 300) },
        });
      }),
    );
  }
  return noticeCounts(noticeId);
}

/** Keeps sending a notice for up to `seconds` (used in the background after Send). */
export async function sendForAWhile(schoolId: string, noticeId: string, seconds = 50) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    const c = await sendNextBatch(schoolId, noticeId);
    if (!c.PENDING) return c;
    if (!(await db.noticeRecipient.count({ where: { noticeId, status: "PENDING", providerRef: null } }))) await new Promise((r) => setTimeout(r, 1000));
  }
  return noticeCounts(noticeId);
}

export async function noticeCounts(noticeId: string) {
  const groups = await db.noticeRecipient.groupBy({ by: ["status"], where: { noticeId }, _count: true });
  const c = { PENDING: 0, SENT: 0, FAILED: 0, SKIPPED: 0 };
  for (const g of groups) c[g.status] = g._count;
  return { ...c, total: c.PENDING + c.SENT + c.FAILED + c.SKIPPED };
}
