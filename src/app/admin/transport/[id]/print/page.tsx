import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowLeft, Bus, Clock, GraduationCap, MapPin, Phone, School, UserRound, Users } from "lucide-react";
import { AutoPrint } from "@/components/fees/auto-print";
import { PdfDownloadButton } from "@/components/pdf-download";
import { PrintButton } from "@/components/print-button";
import { buttonVariants } from "@/components/ui";
import { db } from "@/lib/db";
import { rupees } from "@/lib/fees-shared";
import { fullName, sectionLabel } from "@/lib/queries";
import { getCurrentSchool, schoolLogoUrl } from "@/lib/school";
import { formatTime } from "@/lib/timetable-shared";

const stamp = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const gap = (from: string, to: string) => {
  const m = minutes(to) - minutes(from);
  return m > 0 ? (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ""}`.trim() : `${m} min`) : null;
};

/**
 * A bus or van route on one A4 sheet, for the notice board or the file: the
 * vehicle and its crew, then the journey stop by stop (arrows, pick-up times,
 * fares and riders) ending at the school; optionally the students at each stop.
 */
export default async function RouteSheetPage({ params, searchParams }: PageProps<"/admin/transport/[id]/print">) {
  const { id } = await params;
  const sp = await searchParams;
  const withStudents = sp.students === "1";
  const school = await getCurrentSchool();
  const [route, logo] = await Promise.all([
    db.transportRoute.findFirst({
      where: { id, schoolId: school.id },
      include: {
        students: {
          where: { status: "ACTIVE" },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
          select: { id: true, firstName: true, middleName: true, lastName: true, transportStop: true, section: { include: { class: true } } },
        },
      },
    }),
    db.schoolLogo.findUnique({ where: { schoolId: school.id }, select: { updatedAt: true } }),
  ]);
  if (!route) notFound();
  const logoUrl = schoolLogoUrl({ id: school.id, logo });
  const stops = route.stops.map((name, i) => ({
    name,
    time: route.stopTimes[i] ?? "",
    fare: route.stopFares[i] ?? 0,
    riders: route.students.filter((s) => s.transportStop === name),
  }));
  const timed = stops.filter((s) => s.time);
  const noStop = route.students.filter((s) => !s.transportStop || !route.stops.includes(s.transportStop));
  const base = `/admin/transport/${route.id}/print`;

  return (
    <div className="space-y-4">
      {sp.print === "1" && <AutoPrint />}
      <style>{`@page { size: A4 portrait; margin: 10mm; } @media print { html, body { background: #fff !important; } }`}</style>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href={`/admin/transport/${route.id}`} className={buttonVariants.ghost}>
          <ArrowLeft className="h-4 w-4" /> Route {route.routeNumber}
        </Link>
        <span className="ml-auto flex items-center gap-2 text-sm text-fg-2">
          <Link href={withStudents ? base : `${base}?students=1`} replace aria-pressed={withStudents} className="flex items-center gap-2">
            <span className={`flex h-4 w-4 items-center justify-center rounded border ${withStudents ? "border-accent bg-accent text-accent-fg" : "border-line-strong"}`}>
              {withStudents && "✓"}
            </span>
            Add a page of students by stop
          </Link>
        </span>
        <PdfDownloadButton root="route-sheet" fileName={`Route ${route.routeNumber}${route.name ? ` - ${route.name}` : ""}`} />
        <PrintButton label="Print" />
      </div>

      <div data-pdf-root="route-sheet" className="space-y-6 print:space-y-0">
        {/* Page 1: the route */}
        <article data-pdf-page className="mx-auto w-full max-w-[190mm] rounded-2xl bg-white p-[8mm] text-[9.5pt] text-slate-900 shadow-lift [print-color-adjust:exact] print:max-w-none print:rounded-none print:p-0 print:shadow-none">
          <header className="flex items-center gap-[4mm] border-b-2 border-slate-800 pb-[3mm]">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-[16mm] w-[16mm] object-contain" />
            ) : (
              <span className="flex h-[16mm] w-[16mm] items-center justify-center rounded-full bg-slate-100">
                <GraduationCap className="h-[9mm] w-[9mm] text-slate-500" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[14pt] font-bold uppercase tracking-wide">{school.name}</p>
              {school.address && <p className="text-[8.5pt] text-slate-600">{school.address}</p>}
              {school.phone && <p className="text-[8.5pt] text-slate-600">Phone {school.phone}</p>}
            </div>
            <div className="text-right">
              <p className="text-[8pt] font-semibold uppercase tracking-widest text-slate-500">School transport</p>
              <p className="text-[18pt] font-black leading-none">Route {route.routeNumber}</p>
              {route.name && <p className="mt-[1mm] text-[9pt] font-medium text-slate-700">{route.name}</p>}
            </div>
          </header>

          {/* Vehicle and crew */}
          <section className="mt-[4mm] grid grid-cols-3 gap-[3mm]">
            <InfoBox icon={Bus} label="Vehicle" lines={[route.vehicleNumber, route.vehicleType]} mono />
            <InfoBox icon={UserRound} label="Driver" lines={[route.driverName ?? "—", route.driverPhone && `☎ ${route.driverPhone}`]} />
            <InfoBox icon={Users} label="Attendant" lines={[route.attendantName ?? "—", route.attendantPhone && `☎ ${route.attendantPhone}`]} />
          </section>
          <section className="mt-[3mm] grid grid-cols-4 gap-[3mm] text-center">
            <Stat label="Stops" value={String(stops.length)} />
            <Stat label="Students" value={String(route.students.length)} />
            <Stat label="First pick-up" value={timed[0] ? formatTime(timed[0].time) : "—"} />
            <Stat label="Last pick-up" value={timed.at(-1) ? formatTime(timed.at(-1)!.time) : "—"} />
          </section>

          {/* The journey */}
          <section className="mt-[5mm]">
            <h2 className="mb-[2mm] text-[10pt] font-bold uppercase tracking-wide text-slate-700">Morning pick-up route</h2>
            {stops.length === 0 ? (
              <p className="text-slate-500">No stops added yet.</p>
            ) : (
              <ol className={stops.length > 10 ? "grid grid-cols-2 gap-x-[8mm]" : ""}>
                {stops.map((s, i) => {
                  const next = stops[i + 1];
                  const travel = next?.time && s.time ? gap(s.time, next.time) : null;
                  const first = i === 0;
                  return (
                    <li key={s.name} className="break-inside-avoid">
                      <div className="flex items-stretch gap-[3mm]">
                        <span
                          className={`flex h-[9mm] w-[9mm] shrink-0 items-center justify-center rounded-full text-[11pt] font-bold text-white ${first ? "bg-emerald-600" : "bg-indigo-600"}`}
                        >
                          {i + 1}
                        </span>
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-[2mm] rounded-lg border border-slate-300 px-[3mm] py-[1.5mm]">
                          <div className="min-w-0">
                            <p className="truncate text-[10.5pt] font-semibold">
                              {s.name}
                              {first && <span className="ml-[2mm] rounded bg-emerald-100 px-[1.5mm] text-[7.5pt] font-bold uppercase text-emerald-700">Start</span>}
                            </p>
                            <p className="text-[8pt] text-slate-600">
                              {s.riders.length} student{s.riders.length === 1 ? "" : "s"}
                              {s.fare > 0 && ` · ${rupees(s.fare)} a month`}
                            </p>
                          </div>
                          {s.time && (
                            <span className="flex shrink-0 items-center gap-[1mm] rounded-full bg-slate-900 px-[2.5mm] py-[0.8mm] text-[9pt] font-bold text-white">
                              <Clock className="h-[3mm] w-[3mm]" /> {formatTime(s.time)}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* The arrow to the next stop (or to school after the last) */}
                      <div className="flex items-center gap-[3mm]">
                        <span className="flex w-[9mm] shrink-0 flex-col items-center text-indigo-600">
                          <span className="h-[3mm] w-[1.2mm] rounded-full bg-indigo-600" />
                          <ArrowDown className="-mt-[1.2mm] h-[5.5mm] w-[5.5mm]" strokeWidth={3} />
                        </span>
                        {travel && (
                          <span className="rounded-full bg-indigo-50 px-[2.5mm] py-[0.4mm] text-[7.5pt] font-semibold text-indigo-700">
                            {travel} to {next ? next.name : school.name}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
                <li className="break-inside-avoid">
                  <div className="flex items-stretch gap-[3mm]">
                    <span className="flex h-[9mm] w-[9mm] shrink-0 items-center justify-center rounded-full bg-rose-600 text-white">
                      <School className="h-[5mm] w-[5mm]" />
                    </span>
                    <div className="flex flex-1 items-center rounded-lg border-2 border-rose-300 bg-rose-50 px-[3mm] py-[1.5mm]">
                      <p className="text-[10.5pt] font-bold">{school.name}</p>
                    </div>
                  </div>
                </li>
              </ol>
            )}
            <p className="mt-[2mm] text-[8pt] text-slate-500">
              <MapPin className="mr-[1mm] inline h-[3mm] w-[3mm]" />
              Afternoon drop runs the same stops in reverse. Please be at the stop 5 minutes before the pick-up time.
            </p>
          </section>

          <footer className="mt-[6mm] break-inside-avoid">
            <div className="flex items-center gap-[2mm] rounded-lg bg-slate-100 px-[3mm] py-[2mm] text-[8.5pt]">
              <Phone className="h-[3.5mm] w-[3.5mm] text-slate-600" />
              <span>
                In an emergency call the school office{school.phone ? ` on ${school.phone}` : ""}
                {route.driverPhone ? ` or the driver on ${route.driverPhone}` : ""}.
              </span>
            </div>
            <div className="mt-[12mm] grid grid-cols-2 gap-[20mm] text-center text-[8.5pt] text-slate-600">
              <div className="border-t border-slate-500 pt-[1mm]">Transport in-charge</div>
              <div className="border-t border-slate-500 pt-[1mm]">{school.principalName ? `Principal (${school.principalName})` : "Principal"}</div>
            </div>
            <p className="mt-[3mm] text-right text-[7pt] text-slate-400">Printed {stamp.format(new Date())}</p>
          </footer>
        </article>

        {/* Page 2 (optional): who boards where */}
        {withStudents && (
          <article data-pdf-page className="mx-auto w-full max-w-[190mm] rounded-2xl bg-white p-[8mm] text-[9pt] text-slate-900 shadow-lift [print-color-adjust:exact] print:max-w-none print:break-before-page print:rounded-none print:p-0 print:shadow-none">
            <h2 className="border-b-2 border-slate-800 pb-[2mm] text-[12pt] font-bold">
              Route {route.routeNumber} · Students by stop <span className="font-normal text-slate-500">({route.students.length})</span>
            </h2>
            <div className="mt-[3mm] columns-2 gap-[6mm]">
              {[...stops.map((s, i) => ({ title: `${i + 1}. ${s.name}${s.time ? ` · ${formatTime(s.time)}` : ""}`, riders: s.riders })), ...(noStop.length ? [{ title: "Stop not chosen", riders: noStop }] : [])]
                .filter((g) => g.riders.length)
                .map((g) => (
                  <section key={g.title} className="mb-[3mm] break-inside-avoid">
                    <p className="mb-[1mm] rounded bg-slate-100 px-[2mm] py-[0.5mm] text-[8.5pt] font-bold">{g.title}</p>
                    <ol className="list-decimal pl-[5mm]">
                      {g.riders.map((r) => (
                        <li key={r.id}>
                          {fullName(r)} <span className="text-slate-500">· {r.section ? sectionLabel(r.section) : "No class"}</span>
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
            </div>
          </article>
        )}
      </div>
    </div>
  );
}

function InfoBox({ icon: Icon, label, lines, mono }: { icon: typeof Bus; label: string; lines: (string | null | undefined)[]; mono?: boolean }) {
  const [main, ...rest] = lines.filter(Boolean) as string[];
  return (
    <div className="rounded-lg border border-slate-300 px-[3mm] py-[2mm]">
      <p className="flex items-center gap-[1mm] text-[7.5pt] font-semibold uppercase tracking-wider text-slate-500">
        <Icon className="h-[3mm] w-[3mm]" /> {label}
      </p>
      <p className={`mt-[0.5mm] text-[10.5pt] font-bold ${mono ? "font-mono" : ""}`}>{main}</p>
      {rest.map((l) => (
        <p key={l} className="text-[8.5pt] text-slate-600">
          {l}
        </p>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-100 py-[1.5mm]">
      <p className="text-[7pt] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-[11pt] font-bold">{value}</p>
    </div>
  );
}
