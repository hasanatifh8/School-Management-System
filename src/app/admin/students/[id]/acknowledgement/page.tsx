import { notFound } from "next/navigation";
import { GraduationCap, UserPlus, UserRound, Wallet } from "lucide-react";
import { AutoPrint } from "@/components/fees/auto-print";
import { PrintButton } from "@/components/print-button";
import { ButtonLink, PageHeader } from "@/components/ui";
import { BLOOD_GROUP_LABELS } from "@/lib/blood-groups";
import { db } from "@/lib/db";
import { loadStudentAccount } from "@/lib/fees";
import { FREQUENCY_META, monthLabel, rupees, stopFare } from "@/lib/fees-shared";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";
import { getCurrentSchool, schoolLogoUrl } from "@/lib/school";
import { CATEGORY_LABELS } from "@/lib/student-options";
import { formatTime } from "@/lib/timetable-shared";
import { AdmissionSteps } from "../../new/admission-steps";

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const stamp = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const GENDER = { MALE: "Male", FEMALE: "Female", OTHER: "Other" } as const;
const SCHOOL_TYPE = { PRIVATE: "Private", GOVERNMENT: "Government", SEMI_GOVERNMENT: "Semi-government", OTHER: "Other" } as const;

/** Aadhaar shown with only the last four digits, as is usual on printed forms. */
const maskAadhaar = (a: string) => `XXXX XXXX ${a.replace(/\D/g, "").slice(-4)}`;

/**
 * The admission acknowledgement: everything entered at admission (student,
 * parents, address, class, transport and fees) on one printable A4 page, for
 * the parent and the school's file. The last step of a new admission, and
 * reprintable from the student's profile.
 */
export default async function AdmissionAcknowledgementPage({ params, searchParams }: PageProps<"/admin/students/[id]/acknowledgement">) {
  const { id } = await params;
  const sp = await searchParams;
  const school = await getCurrentSchool();
  const [student, logo, account] = await Promise.all([
    db.student.findFirst({
      where: { id, schoolId: school.id },
      include: {
        section: { include: { class: true } },
        house: true,
        transportRoute: true,
        subjects: { include: { subject: true }, orderBy: { subject: { name: "asc" } } },
      },
    }),
    db.schoolLogo.findUnique({ where: { schoolId: school.id }, select: { updatedAt: true } }),
    loadStudentAccount(school.id, id),
  ]);
  if (!student || !account) notFound();
  const isNew = sp.new === "1";
  const name = fullName(student);
  const logoUrl = schoolLogoUrl({ id: school.id, logo });
  const { session, heads, optionalHeads } = account;

  // Fees: the class's fees, then the opt-in fees (transport among them) the student pays.
  const classId = student.section?.classId;
  const classFees = classId ? heads.filter((h) => !h.optional && h.amounts[classId] > 0).map((h) => ({ name: h.name, often: FREQUENCY_META[h.frequency].label, amount: h.amounts[classId] })) : [];
  const optIn = optionalHeads
    .filter((h) => h.added)
    .map((h) => ({ name: h.name, often: FREQUENCY_META[h.frequency].label, amount: h.amount, months: h.from || h.to ? `${h.from ? monthLabel(h.from) : "From admission"} – ${h.to ? monthLabel(h.to) : "end of session"}` : null }));
  const route = student.transportRoute;
  const stopAt = route && student.transportStop ? route.stops.indexOf(student.transportStop) : -1;
  const affiliation = [school.board, school.affiliationNo && `Affiliation No. ${school.affiliationNo}`, school.udiseCode && `UDISE ${school.udiseCode}`].filter(Boolean).join(" · ");

  return (
    <div className="space-y-6">
      {sp.print === "1" && <AutoPrint />}
      <div className="print:hidden">
        {isNew ? (
          <>
            <PageHeader
              title="Admission complete"
              subtitle={`${name} is admitted. Print the acknowledgement for the parent and the school's file.`}
              breadcrumbs={[{ label: "Students", href: "/admin/students" }, { label: "New admission" }]}
            />
            <AdmissionSteps current={4} />
          </>
        ) : (
          <PageHeader
            title="Admission acknowledgement"
            breadcrumbs={[{ label: "Students", href: "/admin/students" }, { label: name, href: `/admin/students/${student.id}` }, { label: "Acknowledgement" }]}
          />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <PrintButton label="Print acknowledgement" />
          <ButtonLink href={`/admin/students/${student.id}${isNew ? "?admitted=1" : ""}`} variant="secondary" icon={UserRound}>
            Student profile
          </ButtonLink>
          {student.section && (
            <ButtonLink href={`/admin/fee-desk?s=${student.id}`} variant="secondary" icon={Wallet}>
              Collect fees
            </ButtonLink>
          )}
          {isNew && (
            <ButtonLink href="/admin/students/new" variant="ghost" icon={UserPlus}>
              Next admission
            </ButtonLink>
          )}
        </div>
      </div>

      <style>{`@page { size: A4 portrait; margin: 10mm; } @media print { html, body { background: #fff !important; } }`}</style>

      {/* The acknowledgement: paper colours, so it prints the same in light or dark mode */}
      <article className="mx-auto w-full max-w-[190mm] rounded-2xl bg-white p-[8mm] text-[9.5pt] leading-snug text-slate-900 shadow-lift [print-color-adjust:exact] print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="flex items-start gap-[4mm] border-b-2 border-slate-800 pb-[3mm]">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-[18mm] w-[18mm] object-contain" />
          ) : (
            <span className="flex h-[18mm] w-[18mm] items-center justify-center rounded-full bg-slate-100">
              <GraduationCap className="h-[10mm] w-[10mm] text-slate-500" />
            </span>
          )}
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[15pt] font-bold uppercase tracking-wide">{school.name}</p>
            {school.address && <p className="text-[8.5pt] text-slate-600">{school.address}</p>}
            <p className="text-[8.5pt] text-slate-600">{[school.phone && `Phone ${school.phone}`, school.email, school.website].filter(Boolean).join(" · ")}</p>
            {affiliation && <p className="text-[8pt] text-slate-500">{affiliation}</p>}
          </div>
          <span className="w-[18mm]" />
        </header>

        <div className="mt-[3mm] flex items-start justify-between gap-[4mm]">
          <div>
            <h1 className="text-[13pt] font-bold uppercase tracking-wider">Admission Acknowledgement</h1>
            <p className="mt-[1mm] text-slate-600">
              Session {session.name}
              {school.schoolType && ` · ${SCHOOL_TYPE[school.schoolType]} school`}
            </p>
            <dl className="mt-[2mm] grid grid-cols-[auto_1fr] gap-x-[3mm] gap-y-[0.5mm]">
              <dt className="text-slate-500">Admission No.</dt>
              <dd className="font-mono font-bold">{student.studentCode}</dd>
              <dt className="text-slate-500">Date of admission</dt>
              <dd className="font-semibold">{dateFmt.format(student.admissionDate)}</dd>
              <dt className="text-slate-500">Class</dt>
              <dd className="font-semibold">{student.section ? sectionLabel(student.section) : "Not assigned"}</dd>
            </dl>
          </div>
          <div className="flex h-[35mm] w-[28mm] shrink-0 items-center justify-center overflow-hidden border border-slate-400 bg-slate-50">
            {student.photoId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl(student.photoId)!} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="px-[2mm] text-center text-[7.5pt] text-slate-400">Affix photograph</span>
            )}
          </div>
        </div>

        <Section title="1. Student details">
          <Item label="Full name" value={name} wide strong />
          <Item label="Gender" value={student.gender && GENDER[student.gender]} />
          <Item label="Date of birth" value={student.dateOfBirth && dateFmt.format(student.dateOfBirth)} />
          <Item label="Blood group" value={student.bloodGroup && BLOOD_GROUP_LABELS[student.bloodGroup]} />
          <Item label="Aadhaar No." value={student.aadhaarNumber && maskAadhaar(student.aadhaarNumber)} />
          <Item label="Nationality" value={student.nationality} />
          <Item label="Religion" value={student.religion} />
          <Item label="Category" value={student.category && CATEGORY_LABELS[student.category]} />
          <Item label="Caste" value={student.caste} />
          <Item label="Email" value={student.email} />
        </Section>

        <Section title="2. Parent & guardian details">
          <Item label="Father's name" value={student.fatherName} />
          <Item label="Father's occupation" value={student.fatherOccupation} />
          <Item label="Mother's name" value={student.motherName} />
          <Item label="Guardian" value={student.guardianName && `${student.guardianName}${student.guardianRelation ? ` (${student.guardianRelation})` : ""}`} />
          <Item label="Mobile" value={student.phone} />
          <Item label="WhatsApp" value={student.whatsappNumber} />
        </Section>

        <Section title="3. Address">
          <Item label="Permanent address" value={student.primaryAddress} wide />
          <Item label="Correspondence address" value={student.correspondenceAddress && student.correspondenceAddress !== student.primaryAddress ? student.correspondenceAddress : student.primaryAddress ? "Same as permanent address" : null} wide />
        </Section>

        <Section title="4. Admission details">
          <Item label="Class & section" value={student.section ? sectionLabel(student.section) : null} />
          <Item label="Roll No." value={student.rollNumber != null ? String(student.rollNumber) : null} />
          <Item label="House" value={student.house?.name} />
          <Item label="Previous school" value={student.lastSchoolName} />
          <Item label="Subjects" value={student.subjects.length ? student.subjects.map((s) => s.subject.name).join(", ") : null} wide />
        </Section>

        <Section title="5. School transport">
          {route ? (
            <>
              <Item label="Route" value={`${route.routeNumber}${route.name ? ` · ${route.name}` : ""}`} />
              <Item label="Vehicle" value={`${route.vehicleNumber}${route.vehicleType ? ` · ${route.vehicleType}` : ""}`} />
              <Item label="Pick-up stop" value={student.transportStop} />
              <Item label="Pick-up time" value={stopAt >= 0 && route.stopTimes[stopAt] ? formatTime(route.stopTimes[stopAt]) : null} />
              <Item label="Driver" value={route.driverName && `${route.driverName}${route.driverPhone ? ` · ${route.driverPhone}` : ""}`} />
              <Item label="Monthly fare" value={stopFare(student) ? rupees(stopFare(student)) : null} />
            </>
          ) : (
            <Item label="Transport" value="Does not use school transport" wide />
          )}
        </Section>

        <section className="mt-[4mm] break-inside-avoid">
          <h2 className="mb-[1.5mm] border-b border-slate-300 pb-[1mm] text-[10pt] font-bold uppercase tracking-wide text-slate-700">6. Fees for session {session.name}</h2>
          {classFees.length + optIn.length === 0 ? (
            <p className="text-slate-500">No fees set{student.section ? ` for ${student.section.class.name}` : " (no class assigned)"}.</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-50 text-left text-[8.5pt]">
                  <th className="py-[1mm] pl-[1.5mm] font-semibold">Fee</th>
                  <th className="py-[1mm] font-semibold">Charged</th>
                  <th className="py-[1mm] pr-[1.5mm] text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {classFees.map((f) => (
                  <tr key={f.name} className="border-b border-slate-200">
                    <td className="py-[1mm] pl-[1.5mm]">{f.name}</td>
                    <td className="py-[1mm] text-slate-600">{f.often}</td>
                    <td className="py-[1mm] pr-[1.5mm] text-right tabular-nums">{rupees(f.amount)}</td>
                  </tr>
                ))}
                {optIn.map((f) => (
                  <tr key={f.name} className="border-b border-slate-200">
                    <td className="py-[1mm] pl-[1.5mm]">
                      {f.name} <span className="text-[8pt] text-slate-500">(opted)</span>
                    </td>
                    <td className="py-[1mm] text-slate-600">
                      {f.often}
                      {f.months && <span className="text-[8pt]"> · {f.months}</span>}
                    </td>
                    <td className="py-[1mm] pr-[1.5mm] text-right tabular-nums">{rupees(f.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-[1mm] text-[8pt] text-slate-500">Amounts are per instalment. Fees are charged from the month of admission unless the school has noted otherwise.</p>
        </section>

        <section className="mt-[5mm] break-inside-avoid">
          <p className="text-[8.5pt] text-slate-700">
            This is to acknowledge that the admission of <strong>{name}</strong> has been registered in {school.name} with Admission No.{" "}
            <strong className="font-mono">{student.studentCode}</strong>
            {student.section ? ` in ${sectionLabel(student.section)}` : ""} for session {session.name}. The parent/guardian declares that the details above are correct
            and agrees to abide by the rules of the school.
          </p>
          <div className="mt-[14mm] grid grid-cols-3 gap-[8mm] text-center text-[8.5pt]">
            {["Parent / Guardian", "Admission in-charge", school.principalName ? `Principal (${school.principalName})` : "Principal"].map((s) => (
              <div key={s} className="border-t border-slate-500 pt-[1mm] text-slate-600">
                {s}
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-[5mm] flex justify-between border-t border-slate-200 pt-[1.5mm] text-[7pt] text-slate-400">
          <span>Computer-generated acknowledgement · {school.name}</span>
          <span>Printed {stamp.format(new Date())}</span>
        </footer>
      </article>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-[4mm] break-inside-avoid">
      <h2 className="mb-[1.5mm] border-b border-slate-300 pb-[1mm] text-[10pt] font-bold uppercase tracking-wide text-slate-700">{title}</h2>
      <dl className="grid grid-cols-2 gap-x-[6mm] gap-y-[1.2mm]">{children}</dl>
    </section>
  );
}

function Item({ label, value, wide, strong }: { label: string; value: string | null | undefined; wide?: boolean; strong?: boolean }) {
  return (
    <div className={`grid grid-cols-[34mm_1fr] gap-x-[2mm] ${wide ? "col-span-2" : ""}`}>
      <dt className="text-slate-500">{label}</dt>
      <dd className={`${strong ? "font-bold" : "font-medium"} ${value ? "" : "text-slate-400"}`}>{value || "—"}</dd>
    </div>
  );
}
