import Link from "next/link";
import { CalendarClock, CircleCheck, CircleSlash, CircleX, Clock, Paperclip, RotateCcw } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, Table, tbodyClass, tdClass, thClass, theadClass } from "@/components/ui";
import { processNotice, retryFailed } from "@/app/admin/notices/actions";
import { Pagination } from "@/components/pagination";
import { db } from "@/lib/db";
import { paginate } from "@/lib/pagination";
import { todayISO } from "@/lib/attendance-shared";
import { NOTICE_STATUS, noticeStatus } from "@/lib/notices-shared";
import { CHANNEL_LABELS, noticeCounts } from "@/lib/messaging/server";
import { DeliveryProgress } from "./delivery-progress";

const when = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "Published 2 Oct · until 9 Oct" (or "Publishes …" while scheduled). */
function schedule(n: { publishAt: Date; expiresOn: Date | null }, status: keyof typeof NOTICE_STATUS) {
  const from = `${status === "SCHEDULED" ? "Publishes" : "Published"} ${when.format(n.publishAt)}`;
  return n.expiresOn ? `${from} · until ${day.format(n.expiresOn)}` : from;
}
const STATUS = {
  SENT: { tone: "green", label: "Sent", icon: CircleCheck },
  FAILED: { tone: "red", label: "Failed", icon: CircleX },
  SKIPPED: { tone: "amber", label: "Skipped", icon: CircleSlash },
  PENDING: { tone: "slate", label: "Waiting", icon: Clock },
} as const;

/** A sent notice: the message, delivery progress and every recipient's result. */
export async function NoticeDetail({ noticeId }: { noticeId: string }) {
  const [notice, counts] = await Promise.all([
    db.notice.findUniqueOrThrow({
      where: { id: noticeId },
      include: {
        recipients: { orderBy: [{ status: "asc" }, { className: "asc" }, { name: "asc" }] },
        attachment: { select: { token: true, fileName: true, size: true } },
      },
    }),
    noticeCounts(noticeId),
  ]);
  const status = noticeStatus(notice, new Date(), todayISO());
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <Card
          title={notice.title}
          description={`${notice.audience} · ${notice.channels.map((c) => CHANNEL_LABELS[c]).join(" + ")} · by ${notice.sentBy}`}
          action={<Badge tone={NOTICE_STATUS[status].tone} dot>{NOTICE_STATUS[status].label}</Badge>}
          className="xl:col-span-2"
        >
          <p className="whitespace-pre-wrap text-sm text-fg">{notice.body}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3 text-sm text-fg-2">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4 text-muted" />
              {schedule(notice, status)}
            </span>
            {notice.attachment && (
              <a href={`/n/${notice.attachment.token}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 font-medium text-accent-text hover:underline">
                <Paperclip className="h-4 w-4" />
                {notice.attachment.fileName}
              </a>
            )}
          </div>
          {status === "SCHEDULED" && <p className="mt-2 text-xs text-muted">Messages go out automatically at the publish time.</p>}
        </Card>
        <Card title="Delivery" className="self-start">
          <DeliveryProgress key={counts.PENDING} initial={counts} process={processNotice.bind(null, notice.id)} />
          {counts.FAILED > 0 && counts.PENDING === 0 && (
            <ActionForm action={retryFailed.bind(null, notice.id)} compact className="mt-4 flex items-center gap-3">
              <SubmitButton variant="secondary" size="sm" icon={<RotateCcw className="h-4 w-4" />}>
                Retry {counts.FAILED} failed
              </SubmitButton>
            </ActionForm>
          )}
        </Card>
      </div>

      <Card title="Recipients" description={`${notice.recipients.length} message(s)`} padded={false}>
        <Table>
          <thead className={theadClass}>
            <tr>
              <th className={thClass}>Recipient</th>
              <th className={thClass}>Channel</th>
              <th className={thClass}>Number</th>
              <th className={thClass}>Status</th>
            </tr>
          </thead>
          <tbody className={tbodyClass}>
            {notice.recipients.map((r) => {
              const s = STATUS[r.status];
              return (
                <tr key={r.id}>
                  <td className={tdClass}>
                    <p className="font-medium text-fg">{r.name}</p>
                    <p className="text-xs text-muted">{r.teacherId || r.staffId ? r.className : r.className ? `Parent · ${r.className}` : "—"}</p>
                  </td>
                  <td className={tdClass}>{CHANNEL_LABELS[r.channel]}</td>
                  <td className={`${tdClass} font-mono text-xs`}>{r.phone ?? "—"}</td>
                  <td className={tdClass}>
                    <Badge tone={s.tone}>
                      <s.icon className="h-3 w-3" />
                      {s.label}
                    </Badge>
                    {r.error && <p className="mt-1 max-w-md text-xs text-muted">{r.error}</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

/** Recent notices with their delivery totals. */
export async function NoticeList({
  where,
  href,
  params,
}: {
  where: { schoolId: string; teacherId?: string };
  href: (id: string) => string;
  /** The page's search params, for pagination. */
  params: Record<string, string | string[] | undefined>;
}) {
  const paging = paginate(params, await db.notice.count({ where }));
  const notices = await db.notice.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: paging.skip,
    take: paging.take,
    include: { recipients: { select: { status: true } }, attachment: { select: { fileName: true } } },
  });
  const now = new Date();
  const today = todayISO();
  if (!notices.length) return <p className="p-6 text-sm text-muted">No notices sent yet.</p>;
  return (
    <>
      <ul className="divide-y divide-line">
        {notices.map((n) => {
          const sent = n.recipients.filter((r) => r.status === "SENT").length;
          const failed = n.recipients.filter((r) => r.status === "FAILED").length;
          const waiting = n.recipients.filter((r) => r.status === "PENDING").length;
          const status = noticeStatus(n, now, today);
          return (
            <li key={n.id}>
              <Link href={href(n.id)} className="flex flex-wrap items-center gap-3 px-6 py-3 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-medium text-fg">
                    {n.title}
                    {n.attachment && <Paperclip className="h-3.5 w-3.5 shrink-0 text-subtle" aria-label="Has an attachment" />}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {n.audience} · {n.channels.map((c) => CHANNEL_LABELS[c]).join(" + ")} · {n.sentBy} · {schedule(n, status)}
                  </p>
                </div>
                <span className="flex flex-wrap gap-1.5">
                  <Badge tone={NOTICE_STATUS[status].tone} dot>
                    {NOTICE_STATUS[status].label}
                  </Badge>
                  {status !== "SCHEDULED" && <Badge tone="green">{sent} sent</Badge>}
                  {failed > 0 && <Badge tone="red">{failed} failed</Badge>}
                  {waiting > 0 && <Badge>{waiting} waiting</Badge>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Pagination paging={paging} noun="notices" />
    </>
  );
}

/**
 * Active notices addressed to teachers or to staff, for their notice board:
 * published, not expired, newest first.
 */
/**
 * Active notices for a portal. "teachers" also shows staff notices and
 * school-wide ones (sent to every family), so teachers know what parents heard.
 */
export async function NoticeBoard({ schoolId, audience, title, empty }: { schoolId: string; audience: "teachers" | "staff"; title: string; empty?: string }) {
  const now = new Date();
  const today = todayISO();
  const notices = (
    await db.notice.findMany({
      where: {
        schoolId,
        publishAt: { lte: now },
        ...(audience === "teachers"
          ? { OR: [{ forTeachers: true }, { forStaff: true }, { audience: { startsWith: "Whole school" } }] }
          : { forStaff: true }),
      },
      orderBy: { publishAt: "desc" },
      take: 30,
      include: { attachment: { select: { token: true, fileName: true } } },
    })
  ).filter((n) => noticeStatus(n, now, today) === "ACTIVE");
  if (!notices.length && !empty) return null;
  return (
    <Card title={title} description="Active notices from the school office" padded={false}>
      {notices.length === 0 ? (
        <p className="px-6 py-5 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {notices.slice(0, 10).map((n) => (
            <li key={n.id} className="px-6 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium text-fg">{n.title}</p>
                <span className="text-xs text-muted">{schedule(n, "ACTIVE")}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-fg-2">{n.body}</p>
              {n.attachment && (
                <a href={`/n/${n.attachment.token}`} target="_blank" rel="noopener" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-accent-text hover:underline">
                  <Paperclip className="h-4 w-4" />
                  {n.attachment.fileName}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
