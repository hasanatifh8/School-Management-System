import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { formatISO, isoDate, parseISODate, shortDate, todayISO } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { fullName, sectionLabel } from "@/lib/queries";
import { canEncrypt, decrypt } from "@/lib/secrets";
import { noticeStatus } from "@/lib/notices-shared";
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
  | { type: "school" }
  | { type: "none" }; // no students: teachers and/or staff only

/** Teachers and non-teaching staff who get the notice too (admins only). */
export type Roles = { teachers: boolean; staff: boolean };

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
    case "none":
      return { students: [], label: "" };
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

/** Someone a notice goes to: a student's parent, a teacher or a staff member. */
type Person = {
  ref: { studentId: string } | { teacherId: string } | { staffId: string };
  name: string;
  className: string | null; // class, or "Teacher" / the staff member's job
  phone: string | null;
  whatsapp: string | null;
  roll: string;
  father: string;
};

/** Students (from `spec`) plus, when chosen, active teachers and staff. */
export async function resolveRecipients(schoolId: string, spec: AudienceSpec, roles: Roles, onlySectionId?: string) {
  const [{ students, label }, teachers, staff] = await Promise.all([
    resolveAudience(schoolId, spec, onlySectionId),
    roles.teachers && !onlySectionId
      ? db.teacher.findMany({ where: { schoolId, status: "ACTIVE" }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }], select: { id: true, firstName: true, middleName: true, lastName: true, phone: true, whatsappNumber: true } })
      : [],
    roles.staff && !onlySectionId
      ? db.staffMember.findMany({ where: { schoolId, status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, designation: true, phone: true, whatsappNumber: true } })
      : [],
  ]);
  const people: Person[] = [
    ...students.map((s) => ({
      ref: { studentId: s.id },
      name: fullName(s),
      className: s.section ? `${s.section.class.name} – ${s.section.name}` : null,
      phone: s.phone,
      whatsapp: s.whatsappNumber,
      roll: s.rollNumber != null ? String(s.rollNumber) : "",
      father: s.fatherName ?? "",
    })),
    ...teachers.map((t) => ({ ref: { teacherId: t.id }, name: fullName(t), className: "Teacher", phone: t.phone, whatsapp: t.whatsappNumber, roll: "", father: "" })),
    ...staff.map((m) => ({ ref: { staffId: m.id }, name: m.name, className: m.designation, phone: m.phone, whatsapp: m.whatsappNumber, roll: "", father: "" })),
  ];
  const labels = [label, teachers.length || roles.teachers ? "Teachers" : "", staff.length || roles.staff ? "Staff" : ""].filter(Boolean);
  return { people, label: labels.join(" · ") || "No one chosen", counts: { students: students.length, teachers: teachers.length, staff: staff.length } };
}

/** One message for one person on one channel. Placeholders use the person's own name for teachers and staff. */
function recipientFor(p: Person, channel: Channel, body: string, school: string, date: string, attachmentUrl: string | null) {
  const raw = channel === "WHATSAPP" ? (p.whatsapp ?? p.phone) : p.phone;
  const phone = raw ? normalizeIndianMobile(raw) : null;
  const text = personalize(body, { student: p.name, class: p.className ?? "", roll: p.roll, father: p.father, date, school });
  return {
    ...p.ref,
    name: p.name,
    className: p.className,
    phone,
    channel,
    message: attachmentUrl ? `${text}\n\nAttachment: ${attachmentUrl}` : text,
    status: phone ? ("PENDING" as const) : ("SKIPPED" as const),
    error: phone ? null : raw ? `Not a valid mobile number: ${raw}` : "No mobile number",
  };
}

/** How many messages a notice would send, who to, and the first one as a sample. */
export async function previewAudience(
  schoolId: string,
  schoolName: string,
  spec: AudienceSpec,
  roles: Roles,
  channels: Channel[],
  body: string,
  onlySectionId?: string,
  attachmentUrl: string | null = null,
) {
  const { people, label, counts } = await resolveRecipients(schoolId, spec, roles, onlySectionId);
  const date = formatISO(todayISO(), shortDate);
  const rows = people.flatMap((p) => channels.map((c) => recipientFor(p, c, body, schoolName, date, attachmentUrl)));
  return {
    label,
    ...counts,
    people: people.length,
    messages: rows.filter((r) => r.status === "PENDING").length,
    skipped: rows.filter((r) => r.status === "SKIPPED").length,
    sample: rows.find((r) => r.status === "PENDING") ?? rows[0] ?? null,
  };
}

export type NoticeFile = { fileName: string; mimeType: string; size: number; data: Uint8Array<ArrayBuffer> };

/**
 * Saves a notice with one recipient row per person per channel. Messages wait
 * until `publishAt`. An attachment gets a secret link (under `siteUrl`) that
 * every message ends with.
 */
export async function createNotice(input: {
  schoolId: string;
  schoolName: string;
  spec: AudienceSpec;
  roles: Roles;
  channels: Channel[];
  title: string;
  body: string;
  publishAt: Date;
  expiresOn: Date;
  attachment: NoticeFile | null;
  siteUrl: string;
  sentBy: string;
  teacherId?: string;
  onlySectionId?: string;
}) {
  const { people, label } = await resolveRecipients(input.schoolId, input.spec, input.roles, input.onlySectionId);
  const token = input.attachment ? randomBytes(9).toString("base64url") : null;
  const attachmentUrl = token ? `${input.siteUrl}/n/${token}` : null;
  const date = formatISO(isoDate(input.publishAt) > todayISO() ? isoDate(input.publishAt) : todayISO(), shortDate);
  return db.notice.create({
    data: {
      schoolId: input.schoolId,
      title: input.title,
      body: input.body,
      channels: input.channels,
      audience: label,
      forTeachers: input.roles.teachers && !input.onlySectionId,
      forStaff: input.roles.staff && !input.onlySectionId,
      sentBy: input.sentBy,
      teacherId: input.teacherId,
      publishAt: input.publishAt,
      expiresOn: input.expiresOn,
      ...(input.attachment && token && { attachment: { create: { token, ...input.attachment } } }),
      recipients: { create: people.flatMap((p) => input.channels.map((c) => recipientFor(p, c, input.body, input.schoolName, date, attachmentUrl))) },
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
  // A scheduled notice waits for its publish time.
  const notice = await db.notice.findUnique({ where: { id: noticeId }, select: { publishAt: true } });
  if (!notice || notice.publishAt > new Date()) return noticeCounts(noticeId);
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
  const notice = await db.notice.findUnique({ where: { id: noticeId }, select: { publishAt: true } });
  if (!notice || notice.publishAt > new Date()) return noticeCounts(noticeId); // scheduled for later
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

/**
 * Sends notices whose publish time has come and that still have messages
 * waiting (scheduled notices on their day, or any left unfinished), within
 * `seconds`. `schoolId` limits it to one school. Returns how many it worked on.
 */
export async function sendDueNotices(seconds = 50, schoolId?: string) {
  const deadline = Date.now() + seconds * 1000;
  const due = await db.notice.findMany({
    where: { ...(schoolId && { schoolId }), publishAt: { lte: new Date() }, recipients: { some: { status: "PENDING" } } },
    orderBy: { publishAt: "asc" },
    select: { id: true, schoolId: true },
  });
  let worked = 0;
  for (const n of due) {
    const left = Math.floor((deadline - Date.now()) / 1000);
    if (left < 3) break;
    await sendForAWhile(n.schoolId, n.id, left);
    worked++;
  }
  return worked;
}

/** Published notices that haven't expired yet, newest first (`take` at most). */
export async function loadActiveNotices(schoolId: string, take: number, where: Prisma.NoticeWhereInput = {}) {
  const now = new Date();
  const today = todayISO();
  const recent = await db.notice.findMany({
    where: { ...where, schoolId, publishAt: { lte: now } },
    orderBy: { publishAt: "desc" },
    take: take * 4,
    include: { attachment: { select: { token: true, fileName: true } } },
  });
  return recent.filter((n) => noticeStatus(n, now, today) === "ACTIVE").slice(0, take);
}
