// Staff attendance statuses, shared by server and client.

export const STAFF_STATUSES = ["PRESENT", "ABSENT", "LATE", "HALF_DAY", "ON_LEAVE"] as const;
export type StaffStatusKey = (typeof STAFF_STATUSES)[number];

export const STAFF_STATUS_META: Record<StaffStatusKey, { label: string; short: string; on: string; text: string; bar: string; key: string }> = {
  PRESENT: { label: "Present", short: "P", on: "bg-emerald-600 text-white ring-emerald-600", text: "text-success", bar: "bg-emerald-500", key: "p" },
  ABSENT: { label: "Absent", short: "A", on: "bg-rose-600 text-white ring-rose-600", text: "text-danger", bar: "bg-rose-500", key: "a" },
  LATE: { label: "Late", short: "L", on: "bg-orange-500 text-white ring-orange-500", text: "text-orange-600 dark:text-orange-300", bar: "bg-orange-400", key: "l" },
  HALF_DAY: { label: "Half day", short: "HD", on: "bg-yellow-400 text-yellow-950 ring-yellow-400", text: "text-yellow-700 dark:text-yellow-300", bar: "bg-yellow-400", key: "h" },
  ON_LEAVE: { label: "On leave", short: "LV", on: "bg-violet-600 text-white ring-violet-600", text: "text-violet-700 dark:text-violet-300", bar: "bg-violet-500", key: "v" },
};

export const STAFF_GROUPS = ["teaching", "non-teaching"] as const;
export type StaffGroup = (typeof STAFF_GROUPS)[number];
export const pickStaffGroup = (v: unknown): StaffGroup => (v === "non-teaching" ? "non-teaching" : "teaching");
