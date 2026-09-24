import "server-only";
import { cache } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { academicStartYear, sessionDates, sessionName } from "@/lib/session-dates";

export { academicStartYear, sessionDates, sessionName };

/** The school's current session, created for this academic year if missing. */
export const getCurrentSession = cache(async (schoolId: string) => {
  const current = await db.academicSession.findFirst({ where: { schoolId, status: "CURRENT" } });
  if (current) return current;
  const year = academicStartYear();
  return db.academicSession.upsert({
    where: { schoolId_name: { schoolId, name: sessionName(year) } },
    create: { schoolId, name: sessionName(year), ...sessionDates(year), status: "CURRENT" },
    update: { status: "CURRENT" },
  });
});

export function getUpcomingSession(schoolId: string) {
  return db.academicSession.findFirst({ where: { schoolId, status: "UPCOMING" }, orderBy: { startDate: "asc" } });
}

/** The session after `current`, created as UPCOMING if it doesn't exist yet. */
export async function ensureNextSession(
  tx: Prisma.TransactionClient,
  schoolId: string,
  current: { startDate: Date },
) {
  const year = current.startDate.getUTCFullYear() + 1;
  const name = sessionName(year);
  return tx.academicSession.upsert({
    where: { schoolId_name: { schoolId, name } },
    create: { schoolId, name, ...sessionDates(year), status: "UPCOMING" },
    update: {},
  });
}

/** Classes that still have active students without a year-end decision. */
export async function pendingPromotions(schoolId: string, currentSessionId: string) {
  const students = await db.student.findMany({
    where: { schoolId, status: "ACTIVE", sectionId: { not: null } },
    select: {
      section: { select: { class: { select: { id: true, name: true, sortOrder: true } } } },
      enrollments: { where: { sessionId: currentSessionId }, select: { result: true } },
    },
  });
  const pending = new Map<string, { id: string; name: string; sortOrder: number; count: number }>();
  for (const s of students) {
    if (s.enrollments[0]?.result) continue;
    const c = s.section!.class;
    const entry = pending.get(c.id) ?? { ...c, count: 0 };
    entry.count++;
    pending.set(c.id, entry);
  }
  return [...pending.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}
