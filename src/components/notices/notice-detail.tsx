import Link from "next/link";
import { CircleCheck, CircleSlash, CircleX, Clock, RotateCcw } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, Table, tbodyClass, tdClass, thClass, theadClass } from "@/components/ui";
import { processNotice, retryFailed } from "@/app/admin/notices/actions";
import { db } from "@/lib/db";
import { CHANNEL_LABELS, noticeCounts } from "@/lib/messaging/server";
import { DeliveryProgress } from "./delivery-progress";

const when = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const STATUS = {
  SENT: { tone: "green", label: "Sent", icon: CircleCheck },
  FAILED: { tone: "red", label: "Failed", icon: CircleX },
  SKIPPED: { tone: "amber", label: "Skipped", icon: CircleSlash },
  PENDING: { tone: "slate", label: "Waiting", icon: Clock },
} as const;

/** A sent notice: the message, delivery progress and every recipient's result. */
export async function NoticeDetail({ noticeId }: { noticeId: string }) {
  const [notice, counts] = await Promise.all([
    db.notice.findUniqueOrThrow({ where: { id: noticeId }, include: { recipients: { orderBy: [{ status: "asc" }, { className: "asc" }, { name: "asc" }] } } }),
    noticeCounts(noticeId),
  ]);
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title={notice.title} description={`${notice.audience} · ${notice.channels.map((c) => CHANNEL_LABELS[c]).join(" + ")} · by ${notice.sentBy}, ${when.format(notice.createdAt)}`} className="xl:col-span-2">
          <p className="whitespace-pre-wrap text-sm text-slate-800">{notice.body}</p>
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
              <th className={thClass}>Student</th>
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
                    <p className="font-medium text-slate-900">{r.name}</p>
                    <p className="text-xs text-slate-500">{r.className ?? "—"}</p>
                  </td>
                  <td className={tdClass}>{CHANNEL_LABELS[r.channel]}</td>
                  <td className={`${tdClass} font-mono text-xs`}>{r.phone ?? "—"}</td>
                  <td className={tdClass}>
                    <Badge tone={s.tone}>
                      <s.icon className="h-3 w-3" />
                      {s.label}
                    </Badge>
                    {r.error && <p className="mt-1 max-w-md text-xs text-slate-500">{r.error}</p>}
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
export async function NoticeList({ where, href }: { where: { schoolId: string; teacherId?: string }; href: (id: string) => string }) {
  const notices = await db.notice.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { recipients: { select: { status: true } } },
  });
  if (!notices.length) return <p className="p-6 text-sm text-slate-500">No notices sent yet.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {notices.map((n) => {
        const sent = n.recipients.filter((r) => r.status === "SENT").length;
        const failed = n.recipients.filter((r) => r.status === "FAILED").length;
        const waiting = n.recipients.filter((r) => r.status === "PENDING").length;
        return (
          <li key={n.id}>
            <Link href={href(n.id)} className="flex flex-wrap items-center gap-3 px-6 py-3 hover:bg-slate-50">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">{n.title}</p>
                <p className="truncate text-xs text-slate-500">
                  {n.audience} · {n.channels.map((c) => CHANNEL_LABELS[c]).join(" + ")} · {n.sentBy} · {when.format(n.createdAt)}
                </p>
              </div>
              <span className="flex gap-1.5">
                <Badge tone="green">{sent} sent</Badge>
                {failed > 0 && <Badge tone="red">{failed} failed</Badge>}
                {waiting > 0 && <Badge>{waiting} waiting</Badge>}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
