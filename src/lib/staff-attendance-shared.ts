// Staff attendance statuses, shared by server and client.

export const STAFF_STATUSES = ["PRESENT", "ABSENT", "HALF_DAY", "ON_LEAVE"] as const;
export type StaffStatusKey = (typeof STAFF_STATUSES)[number];

export const STAFF_STATUS_META: Record<StaffStatusKey, { label: string; short: string; on: string; bar: string; key: string }> = {
  PRESENT: { label: "Present", short: "P", on: "bg-emerald-600 text-white ring-emerald-600", bar: "bg-emerald-500", key: "p" },
  ABSENT: { label: "Absent", short: "A", on: "bg-rose-600 text-white ring-rose-600", bar: "bg-rose-500", key: "a" },
  HALF_DAY: { label: "Half day", short: "HD", on: "bg-sky-600 text-white ring-sky-600", bar: "bg-sky-500", key: "h" },
  ON_LEAVE: { label: "On leave", short: "LV", on: "bg-violet-600 text-white ring-violet-600", bar: "bg-violet-500", key: "v" },
};

export const STAFF_GROUPS = ["teaching", "non-teaching"] as const;
export type StaffGroup = (typeof STAFF_GROUPS)[number];
export const pickStaffGroup = (v: unknown): StaffGroup => (v === "non-teaching" ? "non-teaching" : "teaching");
