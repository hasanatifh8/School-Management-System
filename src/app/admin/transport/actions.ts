"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionState, optionalMobile, validationError } from "@/lib/action-state";
import { db } from "@/lib/db";
import { getCurrentSchool } from "@/lib/school";

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
  stops: z
    .string()
    .optional()
    .transform((v) => [...new Set((v ?? "").split("\n").map((s) => s.trim().slice(0, 60)).filter(Boolean))]),
});

/** Adds (id null) or changes a route. Students at a stop that was removed keep the route but lose the stop. */
export async function saveRoute(id: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const parsed = routeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const data = parsed.data;
  if (data.stops.length > MAX_STOPS) return { error: `A route can have at most ${MAX_STOPS} stops.`, fieldErrors: { stops: ["Too many stops"] } };

  const clash = await db.transportRoute.findFirst({ where: { schoolId: school.id, routeNumber: data.routeNumber, ...(id && { id: { not: id } }) } });
  if (clash) return { error: `Route ${data.routeNumber} already exists.`, fieldErrors: { routeNumber: ["Already used"] } };

  if (id) {
    const existing = await db.transportRoute.findFirst({ where: { id, schoolId: school.id } });
    if (!existing) return { error: "Route not found." };
    await db.$transaction([
      db.transportRoute.update({ where: { id }, data }),
      db.student.updateMany({ where: { transportRouteId: id, transportStop: { notIn: data.stops } }, data: { transportStop: null } }),
    ]);
  } else {
    await db.transportRoute.create({ data: { ...data, schoolId: school.id } });
  }
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

/** Puts a student on a route and stop, or (no route) takes them off transport. */
export async function assignTransport(studentId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const school = await getCurrentSchool();
  const student = await db.student.findFirst({ where: { id: studentId, schoolId: school.id }, select: { id: true } });
  if (!student) return { error: "Student not found." };
  const routeId = String(formData.get("routeId") ?? "");
  if (!routeId) {
    await db.student.update({ where: { id: studentId }, data: { transportRouteId: null, transportStop: null } });
    revalidatePath("/", "layout");
    return { ok: true, message: "Taken off school transport." };
  }
  const route = await db.transportRoute.findFirst({ where: { id: routeId, schoolId: school.id } });
  if (!route) return { error: "Route not found." };
  const stop = String(formData.get("stop") ?? "");
  if (route.stops.length && !route.stops.includes(stop)) return { error: "Choose the student's stop.", fieldErrors: { stop: ["Choose a stop"] } };
  await db.student.update({ where: { id: studentId }, data: { transportRouteId: route.id, transportStop: stop || null } });
  revalidatePath("/", "layout");
  return { ok: true, message: `Assigned to route ${route.routeNumber}${stop ? `, ${stop}` : ""}.` };
}
