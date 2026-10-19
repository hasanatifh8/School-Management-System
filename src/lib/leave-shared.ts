// Leave requests: labels shared by server and client. No server-only imports.

export const LEAVE_APPLICANTS = ["STUDENT", "TEACHER", "STAFF"] as const;
export type LeaveApplicantKey = (typeof LEAVE_APPLICANTS)[number];
export const APPLICANT_LABELS: Record<LeaveApplicantKey, string> = { STUDENT: "Student", TEACHER: "Teacher", STAFF: "Staff" };

export const LEAVE_CATEGORIES = ["PRIVILEGED", "SICK", "CASUAL", "FAMILY", "EMERGENCY", "OTHER"] as const;
export type LeaveCategoryKey = (typeof LEAVE_CATEGORIES)[number];
export const CATEGORY_LABELS: Record<LeaveCategoryKey, string> = {
  PRIVILEGED: "Privileged leave (PL)",
  SICK: "Sick / medical",
  CASUAL: "Casual",
  FAMILY: "Family function",
  EMERGENCY: "Emergency",
  OTHER: "Other",
};

/** Short names for balance chips, e.g. "PL 9 left". */
export const CATEGORY_SHORT: Record<LeaveCategoryKey, string> = { PRIVILEGED: "PL", SICK: "Sick", CASUAL: "Casual", FAMILY: "Family", EMERGENCY: "Emergency", OTHER: "Other" };

/** Leave types a student can ask for (PL is for teachers and staff). */
export const STUDENT_CATEGORIES = LEAVE_CATEGORIES.filter((c) => c !== "PRIVILEGED");

export const LEAVE_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type LeaveStatusKey = (typeof LEAVE_STATUSES)[number];
export const STATUS_LABELS: Record<LeaveStatusKey, string> = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected" };
export const STATUS_TONES = { PENDING: "amber", APPROVED: "green", REJECTED: "red" } as const;

/** Longest single leave request, in days. */
export const MAX_LEAVE_DAYS = 90;

/** Days from one ISO date to another, both included. */
export const leaveDays = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

/** Someone a leave request can be entered for, as the picker lists them. */
export type LeavePerson = { id: string; applicant: LeaveApplicantKey; name: string; sub: string };

/** A teacher's department: their specialisation (e.g. "Mathematics"), else "Teaching". */
export const teacherDepartment = (t: { specialization: string | null }) => t.specialization?.trim() || "Teaching";
/** A staff member's department, else "Non-teaching". */
export const staffDepartment = (s: { department: string | null }) => s.department?.trim() || "Non-teaching";

/** Pending this long (hours) is overdue for a decision. */
export const LEAVE_URGENT_HOURS = 48;

/** Share of a department on leave at once that triggers a warning. */
export const CLASH_SHARE = 0.2;

/* ───────────────────────── Leave rules (Settings → Teacher & staff leave) ───────────────────────── */

/**
 * The school's leave rules for teachers and staff:
 * - `monthly`: most working days of a type that count as leave in one month,
 *   per applicant (e.g. PL 2). Days over it are absent (unpaid), not leave.
 * - `proof`: types that need a supporting document and a written reason.
 */
export type LeaveRules = {
  monthly: Record<"TEACHER" | "STAFF", Partial<Record<LeaveCategoryKey, number>>>;
  proof: LeaveCategoryKey[];
};

/** Until a school sets them: no monthly caps; sick / medical leave needs proof. */
export const DEFAULT_LEAVE_RULES: LeaveRules = { monthly: { TEACHER: {}, STAFF: {} }, proof: ["SICK"] };

/** A school's saved rules (JSON), keeping only known types and whole days; the defaults when unset. */
export function readLeaveRules(raw: unknown): LeaveRules {
  if (!raw || typeof raw !== "object") return DEFAULT_LEAVE_RULES;
  const r = raw as { monthly?: Record<string, Record<string, unknown>>; proof?: unknown };
  const caps = (a: "TEACHER" | "STAFF") => {
    const out: Partial<Record<LeaveCategoryKey, number>> = {};
    for (const c of LEAVE_CATEGORIES) {
      const v = r.monthly?.[a]?.[c];
      if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 31) out[c] = v;
    }
    return out;
  };
  const proof = Array.isArray(r.proof) ? LEAVE_CATEGORIES.filter((c) => (r.proof as unknown[]).includes(c)) : DEFAULT_LEAVE_RULES.proof;
  return { monthly: { TEACHER: caps("TEACHER"), STAFF: caps("STAFF") }, proof };
}

/** Shortest written reason for a type that needs proof. */
export const PROOF_REASON_MIN = 15;

/**
 * Splits a request's working days into those that count as leave and those
 * over the monthly cap, month by month and in date order. `used` is the days of
 * the same type already counted as leave in each month ("2026-10" → days).
 */
export function splitByMonthlyCap(workingDates: string[], cap: number | undefined, used: Record<string, number>) {
  if (cap == null) return { counted: workingDates, over: [] as string[] };
  const left = { ...used };
  const counted: string[] = [];
  const over: string[] = [];
  for (const d of [...workingDates].sort()) {
    const m = d.slice(0, 7);
    if ((left[m] ?? 0) < cap) {
      counted.push(d);
      left[m] = (left[m] ?? 0) + 1;
    } else over.push(d);
  }
  return { counted, over };
}
