// Leave requests: labels shared by server and client. No server-only imports.

export const LEAVE_APPLICANTS = ["STUDENT", "TEACHER", "STAFF"] as const;
export type LeaveApplicantKey = (typeof LEAVE_APPLICANTS)[number];
export const APPLICANT_LABELS: Record<LeaveApplicantKey, string> = { STUDENT: "Student", TEACHER: "Teacher", STAFF: "Staff" };

export const LEAVE_CATEGORIES = ["SICK", "CASUAL", "FAMILY", "EMERGENCY", "OTHER"] as const;
export type LeaveCategoryKey = (typeof LEAVE_CATEGORIES)[number];
export const CATEGORY_LABELS: Record<LeaveCategoryKey, string> = {
  SICK: "Sick / medical",
  CASUAL: "Casual",
  FAMILY: "Family function",
  EMERGENCY: "Emergency",
  OTHER: "Other",
};

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
