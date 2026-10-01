// Notice publishing rules shared by the server and the composer.

/** Notices from before expiry dates existed count as active this long after publishing. */
export const LEGACY_ACTIVE_DAYS = 15;

export type NoticeStatus = "SCHEDULED" | "ACTIVE" | "EXPIRED";

export const NOTICE_STATUS: Record<NoticeStatus, { label: string; tone: "sky" | "green" | "slate" }> = {
  SCHEDULED: { label: "Scheduled", tone: "sky" },
  ACTIVE: { label: "Active", tone: "green" },
  EXPIRED: { label: "Expired", tone: "slate" },
};

/** Files a notice can carry; the server re-checks the actual bytes. */
export const ATTACHMENT_ACCEPT = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";
export const ATTACHMENT_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);

const iso = (d: Date | string) => (typeof d === "string" ? d : d.toISOString()).slice(0, 10);

/**
 * Scheduled until `publishAt`, active through the whole expiry day (dates are
 * India dates), then expired. `today` is today's date in India (YYYY-MM-DD).
 */
export function noticeStatus(n: { publishAt: Date | string; expiresOn: Date | string | null }, now: Date, today: string): NoticeStatus {
  const publishAt = new Date(n.publishAt);
  if (publishAt > now) return "SCHEDULED";
  if (n.expiresOn) return today > iso(n.expiresOn) ? "EXPIRED" : "ACTIVE";
  return now.getTime() - publishAt.getTime() > LEGACY_ACTIVE_DAYS * 86_400_000 ? "EXPIRED" : "ACTIVE";
}

/** When messages for a publish date go out: now for today, 7 AM India time on a later day. */
export function publishTime(date: string, today: string, now = new Date()) {
  return date <= today ? now : new Date(`${date}T01:30:00Z`); // 07:00 IST
}
