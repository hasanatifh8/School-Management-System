"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Megaphone, MessageCircle, MessageSquareText, Paperclip, Users } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, Modal, TextLink } from "@/components/ui";

export type DashboardNotice = {
  id: string;
  title: string;
  body: string;
  audience: string;
  channels: ("WHATSAPP" | "SMS")[];
  sentBy: string;
  createdAt: string; // ISO, when it was published
  expiresOn: string | null; // YYYY-MM-DD
  attachment: { token: string; fileName: string } | null;
  delivery: { total: number; sent: number; failed: number; pending: number; skipped: number };
};

const dateTime = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const dayOnly = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const CHANNEL = { WHATSAPP: { label: "WhatsApp", icon: MessageCircle }, SMS: { label: "SMS", icon: MessageSquareText } } as const;

/** Delivery so far, in a few words. */
function deliveryText(d: DashboardNotice["delivery"]) {
  if (d.pending) return `Sending · ${d.sent} of ${d.total - d.skipped} delivered`;
  if (d.failed) return `${d.sent} delivered · ${d.failed} failed`;
  return `Delivered to ${d.sent}`;
}

/**
 * Published notices that haven't expired, with delivery progress. A notice
 * opens in a quick view; the full notice and resend tools are in Notices.
 */
export function ActiveNoticesCard({ notices }: { notices: DashboardNotice[] }) {
  const [open, setOpen] = useState<DashboardNotice | null>(null);
  return (
    <Card title="Active notices" icon={Megaphone} description="Published and not yet expired" padded={false} action={<TextLink href="/admin/notices/sent">All notices</TextLink>}>
      {notices.length === 0 ? (
        <EmptyState
          compact
          icon={Megaphone}
          title="No recent notices"
          description="Notices sent to parents by WhatsApp or SMS show here."
          action={
            <ButtonLink href="/admin/notices" variant="secondary" size="sm">
              Send a notice
            </ButtonLink>
          }
        />
      ) : (
        <ul className="divide-y divide-line">
          {notices.map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => setOpen(n)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-2 sm:px-6">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{n.title}</span>
                  <span className="block truncate text-xs text-muted">
                    {dateTime.format(new Date(n.createdAt))}
                    {n.expiresOn && ` → ${dayOnly.format(new Date(`${n.expiresOn}T00:00:00Z`))}`} · {n.audience}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <Badge tone="green" dot>
                    Active
                  </Badge>
                  <span className={`text-[11px] ${n.delivery.failed ? "text-warning" : "text-subtle"}`}>{deliveryText(n.delivery)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.title} description={open ? `Sent ${dateTime.format(new Date(open.createdAt))} by ${open.sentBy}` : undefined}>
        {open && (
          <div className="space-y-4 p-6 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge tone="green" dot>
                Active
              </Badge>
              {open.channels.map((c) => {
                const Icon = CHANNEL[c].icon;
                return (
                  <Badge key={c} tone="sky">
                    <Icon className="h-3 w-3" /> {CHANNEL[c].label}
                  </Badge>
                );
              })}
              <Badge>
                <Users className="h-3 w-3" /> {open.audience}
              </Badge>
              {open.expiresOn && <Badge>Until {dayOnly.format(new Date(`${open.expiresOn}T00:00:00Z`))}</Badge>}
            </div>
            <p className="whitespace-pre-wrap rounded-xl bg-surface-2 p-4 text-fg-2">{open.body}</p>
            {open.attachment && (
              <a href={`/n/${open.attachment.token}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 font-medium text-accent-text hover:underline">
                <Paperclip className="h-4 w-4" /> {open.attachment.fileName}
              </a>
            )}
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Delivered", open.delivery.sent, "text-success"],
                ["Sending", open.delivery.pending, "text-fg"],
                ["Failed", open.delivery.failed, open.delivery.failed ? "text-danger" : "text-fg"],
                ["No number", open.delivery.skipped, "text-fg"],
              ].map(([label, value, tone]) => (
                <div key={label as string} className="rounded-xl border border-line px-3 py-2">
                  <dt className="text-eyebrow uppercase text-muted">{label}</dt>
                  <dd className={`text-lg font-semibold tabular-nums ${tone}`}>{value}</dd>
                </div>
              ))}
            </dl>
            <Link href={`/admin/notices/${open.id}`} className="inline-flex items-center gap-1 font-medium text-accent-text underline-offset-4 hover:underline">
              Open in Notices {open.delivery.failed ? "(retry failed)" : ""}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </Modal>
    </Card>
  );
}
