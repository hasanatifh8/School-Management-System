"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionState, optionalMobile, validationError } from "@/lib/action-state";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";
import { getCurrentSession } from "@/lib/sessions";
import { assignStudentTransport, ensureTransportFee, readFeeRange } from "@/lib/transport-fees";
import { sessionMonths } from "@/lib/fees-shared";

const MAX_STOPS = 40;

const optional = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} is too long`)
    .optional()
    .transform((v) => v || null);

const routeSchema = z.object({
  routeNumber: z.string().trim().min(1, "Enter the route number, e.g. R-3").max(20, "Keep it under 20 characters"),
  name: optional(80, "Name"),
  vehicleNumber: z.string().trim().min(4, "Enter the vehicle's registration number").max(20, "Registration number is too long").transform((v) => v.toUpperCase()),
  vehicleType: optional(40, "Vehicle type"),
  driverName: optional(60, "Driver's name"),
  driverPhone: optionalMobile,
  attendantName: optional(60, "Attendant's name"),
  attendantPhone: optionalMobile,
});

/** The stop rows of the route form, in order, with blank rows skipped. */
type Stops = { stops: string[]; stopTimes: string[]; stopFares: number[]; renamed: Map<string, string> };

function readStops(formData: FormData): Stops | { error: string } {
  const all = (key: string) => formData.getAll(key).map((v) => String(v).trim());
  const names = all("stopName").map((v) => v.slice(0, 60));
  const [times, fares, was] = [all("stopTime"), all("stopFare"), all("stopWas")];
  const stops: string[] = [];
  const stopTimes: string[] = [];
  const stopFares: number[] = [];
  const renamed = new Map<string, string>(); // saved name → name now
  for (const [i, name] of names.entries()) {
    const time = times[i] ?? "";
    const fare = fares[i] ?? "";
    if (!name) {
      if (time || (fare && fare !== "0")) return { error: `Stop ${i + 1} has a time or fare but no name.` };
      continue;
    }
    if (stops.some((s) => s.toLowerCase() === name.toLowerCase())) return { error: `“${name}” is listed twice. Give each stop a different name.` };
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { error: `Enter the pick-up time for “${name}”, e.g. 07:10.` };
    const amount = fare ? Number(fare) : 0;
    if (!Number.isInteger(amount) || amount < 0 || amount > 100000) return { error: `Enter the fare for “${name}” in whole rupees.` };
    stops.push(name);
    stopTimes.push(time);
    stopFares.push(amount);
    if (was[i]) renamed.set(was[i], name);
  }
  if (stops.length > MAX_STOPS) return { error: `A route can have at most ${MAX_STOPS} stops.` };
  return { stops, stopTimes, stopFares, renamed };
}

/**
 * Adds (id null) or changes a route. Students follow their stop when it is
 * renamed; at a stop that was removed they keep the route but lose the stop.
 */
export async function saveRoute(id: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const parsed = routeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const read = readStops(formData);
  if ("error" in read) return { error: read.error, fieldErrors: { stops: [read.error] } };
  const { renamed, ...stops } = read;
  const data = { ...parsed.data, ...stops };

  const clash = await db.transportRoute.findFirst({ where: { schoolId: school.id, routeNumber: data.routeNumber, ...(id && { id: { not: id } }) } });
  if (clash) return { error: `Route ${data.routeNumber} already exists.`, fieldErrors: { routeNumber: ["Already used"] } };

  if (id) {
    const existing = await db.transportRoute.findFirst({ where: { id, schoolId: school.id } });
    if (!existing) return { error: "Route not found." };
    // Each student's stop under its current name, or null if the stop was removed.
    const riders = await db.student.findMany({ where: { transportRouteId: id, transportStop: { not: null } }, select: { id: true, transportStop: true } });
    const moves = new Map<string | null, string[]>();
    for (const r of riders) {
      const stop = renamed.get(r.transportStop!) ?? null;
      if (stop !== r.transportStop) moves.set(stop, [...(moves.get(stop) ?? []), r.id]);
    }
    await db.$transaction([
      db.transportRoute.update({ where: { id }, data }),
      ...[...moves].map(([stop, ids]) => db.student.updateMany({ where: { id: { in: ids } }, data: { transportStop: stop } })),
    ]);
  } else {
    await db.transportRoute.create({ data: { ...data, schoolId: school.id } });
  }
  // Stop fares are charged monthly to the students on the bus.
  await ensureTransportFee(school.id, (await getCurrentSession(school.id)).id);
  revalidatePath("/", "layout");
  if (!id) redirect("/admin/transport");
  return { ok: true, message: "Route saved." };
}

export async function deleteRoute(id: string): Promise<ActionState> {
  const school = await getCurrentSchool();
  const { count } = await db.transportRoute.deleteMany({ where: { id, schoolId: school.id } });
  if (!count) return { error: "Route not found." };
  revalidatePath("/", "layout");
  redirect("/admin/transport");
}

/** Puts a student on a route and stop, or (no route) takes them off transport; their transport fee runs for the months chosen. */
export async function assignTransport(studentId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const session = await getCurrentSession(school.id);
  const result = await assignStudentTransport(
    school.id,
    studentId,
    String(formData.get("routeId") ?? ""),
    String(formData.get("stop") ?? ""),
    readFeeRange(formData, sessionMonths(session.startDate.toISOString().slice(0, 10))),
  );
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
