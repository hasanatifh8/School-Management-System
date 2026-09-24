// Academic session naming and dates (April–March). No server-only imports, so the seed can use it.

/** Academic years run April–March: the year a session starts in. */
export function academicStartYear(date = new Date()) {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}

/** 2026 → "2026-27" */
export function sessionName(startYear: number) {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export function sessionDates(startYear: number) {
  return {
    startDate: new Date(Date.UTC(startYear, 3, 1)),
    endDate: new Date(Date.UTC(startYear + 1, 2, 31)),
  };
}
