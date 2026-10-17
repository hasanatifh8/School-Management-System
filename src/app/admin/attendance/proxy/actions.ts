"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { attendanceWindow } from "@/lib/attendance";
import { formatISO, isoDate, parseISODate, shortDate } from "@/lib/attendance-shared";
import { db } from "@/lib/db";
import { onLeave } from "@/lib/leave";
import { timetableDay } from "@/lib/proxy";
import { fullName } from "@/lib/queries";
import { getCurrentSchool, getViewer } from "@/lib/school";
import { logged } from "@/lib/activity";

/**
 * Puts a free teacher in one period of an absent teacher's timetable on a date.
 * Fields: slotId, date, proxyTeacherId. Replaces any proxy already set there.
 */
export async function assignProxy(_: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool(); // admins / Power Admin only
  const slotId = String(formData.get("slotId") ?? "");
  const date = String(formData.get("date") ?? "");
  const proxyTeacherId = String(formData.get("proxyTeacherId") ?? "");
  const d = parseISODate(date);
  const { session } = await attendanceWindow(school.id);
  if (!d || date < isoDate(session.startDate) || date > isoDate(session.endDate)) return { error: `Choose a date in session ${session.name}.` };
  if (!proxyTeacherId) return { error: "Choose a teacher." };

  const [slot, proxy, away, busy] = await Promise.all([
    db.timetableSlot.findFirst({ where: { id: slotId, section: { class: { schoolId: school.id } } }, include: { period: true } }),
    db.teacher.findFirst({ where: { id: proxyTeacherId, schoolId: school.id, status: "ACTIVE" } }),
    onLeave(school.id, d),
    db.staffAttendance.findFirst({ where: { teacherId: proxyTeacherId, date: d, status: { in: ["ABSENT", "ON_LEAVE"] } } }),
  ]);
  if (!slot || !slot.teacherId) return { error: "That period isn't on the timetable any more." };
  if (slot.day !== timetableDay(date)) return { error: "That period isn't on this day." };
  if (!proxy) return { error: "Teacher not found." };
  if (proxy.id === slot.teacherId) return { error: "Choose a different teacher from the one away." };
  if (away.has(proxy.id) || busy) return { error: `${fullName(proxy)} is away on ${formatISO(date, shortDate)}.` };

  // Free in that period: no own class then, and not covering another one.
  const clash = await db.timetableSlot.findFirst({ where: { teacherId: proxy.id, day: slot.day, periodId: slot.periodId } });
  if (clash) return { error: `${fullName(proxy)} teaches another class in ${slot.period.name}.` };
  const double = await db.proxyAssignment.findFirst({
    where: { proxyTeacherId: proxy.id, date: d, slot: { periodId: slot.periodId }, NOT: { slotId } },
  });
  if (double) return { error: `${fullName(proxy)} is already a proxy in ${slot.period.name}.` };

  const viewer = await getViewer();
  const assignedBy = viewer?.kind === "admin" ? `${viewer.admin.name} (admin)` : "Power Admin";
  await db.proxyAssignment.upsert({
    where: { slotId_date: { slotId, date: d } },
    create: { schoolId: school.id, date: d, slotId, absentTeacherId: slot.teacherId, proxyTeacherId: proxy.id, assignedBy },
    update: { proxyTeacherId: proxy.id, absentTeacherId: slot.teacherId, assignedBy },
  });
  revalidatePath("/", "layout");
  return logged("Attendance", { ok: true, message: `${fullName(proxy)} takes ${slot.period.name} on ${formatISO(date, shortDate)}.` });
}

export async function removeProxy(id: string): Promise<ActionState> {
  const school = await getCurrentSchool();
  const { count } = await db.proxyAssignment.deleteMany({ where: { id, schoolId: school.id } });
  if (!count) return { error: "Proxy not found." };
  revalidatePath("/", "layout");
  return logged("Attendance", { ok: true, message: "Proxy removed." });
}
