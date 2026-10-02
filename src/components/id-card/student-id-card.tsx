import type { ReactNode } from "react";
import { Globe, GraduationCap, Mail, MapPin, Phone, ShieldAlert, UserRound } from "lucide-react";
import type { IdCardSchool, IdCardStaff, IdCardStudent } from "@/lib/id-cards";

// Standard ID card (CR80), portrait: 54 × 85.6 mm. Sizes are in mm/pt so the
// printed card comes out at its real size.
const NAVY = "#0b2554";
const GOLD = "#f5b800";

const cardClass =
  "relative h-[85.6mm] w-[54mm] shrink-0 overflow-hidden rounded-[3mm] bg-white text-left text-[#0b2554] shadow-[0_2px_10px_rgba(15,23,42,0.18)] ring-1 ring-slate-200 [print-color-adjust:exact] [-webkit-print-color-adjust:exact] print:shadow-none";

/** "Rising Star Public School" → big first part, smaller rest, like the sample. */
function nameSize(name: string) {
  return name.length <= 16 ? "text-[10.5pt]" : name.length <= 24 ? "text-[8.5pt]" : name.length <= 34 ? "text-[7pt]" : "text-[6pt]";
}

function Logo({ school, size }: { school: IdCardSchool; size: string }) {
  return school.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={school.logoUrl} alt="" className={`${size} shrink-0 rounded-full bg-white object-contain p-[0.6mm]`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-white ring-[0.5mm] ring-[#f5b800]`}>
      <GraduationCap className="h-1/2 w-1/2" color={NAVY} />
    </span>
  );
}

function Motto({ text, className = "" }: { text: string | null; className?: string }) {
  if (!text) return null;
  return <p className={`truncate text-[4.6pt] font-medium uppercase tracking-[0.25em] ${className}`}>{text}</p>;
}

/* ───────────────────────── Front ───────────────────────── */

/** The navy header with the school, the photo and the card's title pill. */
function FrontTop({ school, photoUrl, title }: { school: IdCardSchool; photoUrl: string | null; title: string }) {
  return (
    <>
      <svg className="absolute inset-x-0 top-0 h-[24mm] w-full" viewBox="0 0 54 24" preserveAspectRatio="none" aria-hidden>
        <path d="M0 0H54V17.5C40 22 22 23.5 0 19.5Z" fill={NAVY} />
        <path d="M0 19.5C22 23.5 40 22 54 17.5V19.2C40 23.6 22 25 0 21.2Z" fill={GOLD} />
      </svg>
      <span className="absolute left-1/2 top-[1.8mm] h-[2mm] w-[10mm] -translate-x-1/2 rounded-full bg-white/85" />
      <div className="relative flex items-center gap-[2mm] px-[3.5mm] pt-[5.2mm]">
        <Logo school={school} size="h-[11mm] w-[11mm]" />
        <div className="min-w-0 text-white">
          <p className={`font-extrabold uppercase leading-[1.05] tracking-wide ${nameSize(school.name)}`}>{school.name}</p>
          <Motto text={school.motto} className="mt-[0.8mm] text-white/85" />
        </div>
      </div>
      <div className="absolute left-1/2 top-[21.5mm] h-[22mm] w-[18mm] -translate-x-1/2 overflow-hidden rounded-[1.2mm] bg-sky-100 ring-[0.45mm] ring-[#0b2554]">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <UserRound className="h-full w-full p-[3mm] text-sky-300" />
        )}
      </div>
      <p className="absolute left-1/2 top-[44.6mm] w-[40mm] -translate-x-1/2 rounded-full bg-[#0b2554] py-[0.6mm] text-center text-[6.2pt] font-bold uppercase tracking-wide text-white">
        {title}
      </p>
    </>
  );
}

/** Name, label/value rows and the QR code. */
function FrontDetails({ name, rows, qrSvg }: { name: string; rows: [string, string][]; qrSvg: string }) {
  return (
    <>
      <div className="absolute inset-x-[3.5mm] top-[49.4mm]">
        <p className="mb-[0.4mm] truncate text-center text-[7.2pt] font-bold leading-tight">{name}</p>
        <dl className="w-[33mm] text-[5.3pt] leading-[2.6mm]">
          {rows.map(([label, value]) => (
            <div key={label} className="flex">
              <dt className="w-[14mm] shrink-0 font-medium text-[#0b2554]/80">{label}</dt>
              <dd className="min-w-0 flex-1 truncate border-b-[0.15mm] border-[#0b2554]/25 font-semibold">
                <span className="mr-[0.8mm] font-normal text-[#0b2554]/60">:</span>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="absolute right-[2.5mm] top-[55mm] w-[14mm] text-center">
        <div data-qr className="h-[14mm] w-[14mm] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <p className="mt-[0.4mm] text-[3.6pt] font-medium leading-none">Scan for details</p>
      </div>
    </>
  );
}

/** The navy bottom panel: the holder's address, with "Valid till" beside it. */
function FrontFooter({ address, validTill }: { address: string; validTill: string }) {
  return (
    <>
      <svg className="absolute inset-x-0 bottom-0 h-[12.6mm] w-full" viewBox="0 0 54 12.6" preserveAspectRatio="none" aria-hidden>
        <path d="M0 1.2C16 -0.4 34 3.4 54 1.6V12.6H0Z" fill={GOLD} />
        <path d="M0 2.4C16 0.8 34 4.6 54 2.8V12.6H0Z" fill={NAVY} />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex h-[9.6mm] items-stretch gap-[2mm] px-[3mm] pb-[1.4mm] text-white">
        <div className="flex min-w-0 flex-1 gap-[1mm]">
          <MapPin className="mt-[0.2mm] h-[2.4mm] w-[2.4mm] shrink-0" color={GOLD} />
          <div className="min-w-0">
            <p className="text-[4.2pt] font-semibold uppercase tracking-wider text-white/75">Address</p>
            <p className="line-clamp-2 text-[4.6pt] leading-[1.25]">{address || "—"}</p>
          </div>
        </div>
        <div className="shrink-0 border-l-[0.15mm] border-white/30 pl-[2mm] text-right">
          <p className="text-[4.2pt] font-semibold uppercase tracking-wider text-white/75">Valid till</p>
          <p className="whitespace-nowrap text-[5.2pt] font-bold">{validTill}</p>
        </div>
      </div>
    </>
  );
}

export function IdCardFront({ school, student, validTill }: { school: IdCardSchool; student: IdCardStudent; validTill: string }) {
  const rows: [string, string][] = [
    ["Father's Name", student.fatherName],
    ["Class", [student.className, student.sectionName].filter(Boolean).join(" – ")],
    ["Roll No.", student.roll],
    ["Admission No.", student.admissionNo],
    ["Date of Birth", student.dob],
    ["Blood Group", student.bloodGroup],
    ["Parent Contact", student.parentContact],
  ];
  return (
    <div className={cardClass}>
      <FrontTop school={school} photoUrl={student.photoUrl} title="Student ID Card" />
      <FrontDetails name={student.name} rows={rows} qrSvg={student.qrSvg} />
      <FrontFooter address={student.address} validTill={validTill} />
    </div>
  );
}

export function StaffIdCardFront({ school, staff, validTill }: { school: IdCardSchool; staff: IdCardStaff; validTill: string }) {
  const rows: [string, string][] = [
    ["Employee Code", staff.employeeCode],
    ["Designation", staff.designation],
    ["Department", staff.department],
    ["Blood Group", staff.bloodGroup],
    ["Contact", staff.contact],
  ];
  return (
    <div className={cardClass}>
      <FrontTop school={school} photoUrl={staff.photoUrl} title={staff.teaching ? "Teaching Staff" : "Non-Teaching Staff"} />
      <FrontDetails name={staff.name} rows={rows} qrSvg={staff.qrSvg} />
      <FrontFooter address={staff.address} validTill={validTill} />
    </div>
  );
}

/* ───────────────────────── Back (the same for every card) ───────────────────────── */

function BackSection({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div>
      <p className="mb-[0.6mm] flex items-center gap-[1mm] text-[5.2pt] font-bold uppercase tracking-wider">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

export function IdCardBack({ school }: { school: IdCardSchool }) {
  const contacts = [
    { icon: Phone, value: school.phone },
    { icon: Mail, value: school.email },
    { icon: Globe, value: school.website?.replace(/^https?:\/\//, "") },
  ].filter((c) => c.value);
  return (
    <div className={cardClass}>
      <span className="absolute left-1/2 top-[1.8mm] h-[2mm] w-[10mm] -translate-x-1/2 rounded-full bg-slate-200" />
      <div className="absolute left-1/2 top-[22mm] h-[24mm] w-[24mm] -translate-x-1/2 opacity-[0.05] grayscale">
        <Logo school={school} size="h-full w-full" />
      </div>

      {/* School */}
      <div className="relative flex items-center gap-[2mm] px-[3.5mm] pt-[5mm]">
        <Logo school={school} size="h-[9mm] w-[9mm]" />
        <div className="min-w-0">
          <p className={`font-extrabold uppercase leading-[1.05] tracking-wide ${nameSize(school.name)}`}>{school.name}</p>
          <Motto text={school.motto} className="mt-[0.6mm] text-[#0b2554]/75" />
        </div>
      </div>

      {/* Guidelines and emergency contacts */}
      <div className="absolute inset-x-[3.5mm] top-[17mm] h-[30mm] space-y-[1.8mm] overflow-hidden">
        {school.guidelines.length > 0 && (
          <BackSection title="Guidelines" icon={<span className="h-[1.6mm] w-[1.6mm] rounded-full bg-[#f5b800]" />}>
            <ol className="ml-[2.6mm] list-decimal space-y-[0.3mm] text-[4.5pt] leading-[1.25] text-[#0b2554]/85">
              {school.guidelines.map((g, i) => (
                <li key={i} className="line-clamp-2">
                  {g}
                </li>
              ))}
            </ol>
          </BackSection>
        )}
        {school.emergency.length > 0 && (
          <BackSection title="Emergency contacts" icon={<ShieldAlert className="h-[2.2mm] w-[2.2mm]" color="#be123c" />}>
            <ul className="space-y-[0.2mm] text-[4.7pt] font-semibold leading-[1.3]">
              {school.emergency.map((e, i) => (
                <li key={i} className="truncate">
                  {e}
                </li>
              ))}
            </ul>
          </BackSection>
        )}
      </div>

      {/* Principal */}
      <div className="absolute right-[3.5mm] top-[48.5mm] w-[20mm] text-center">
        <div className="h-[4.5mm] border-b-[0.2mm] border-[#0b2554]/50" />
        <p className="mt-[0.4mm] text-[4.2pt] font-medium text-[#0b2554]/70">Principal</p>
        {school.principalName && <p className="truncate text-[4pt] text-[#0b2554]/60">{school.principalName}</p>}
      </div>

      {/* School address and contacts */}
      <svg className="absolute inset-x-0 bottom-0 h-[29mm] w-full" viewBox="0 0 54 29" preserveAspectRatio="none" aria-hidden>
        <path d="M0 4.5C18 6.5 36 3 54 0.6V2.2C36 4.6 18 8.1 0 6.1Z" fill={GOLD} />
        <path d="M0 6.1C18 8.1 36 4.6 54 2.2V29H0Z" fill={NAVY} />
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-[22mm] px-[3.5mm] pt-[0.5mm] text-white">
        <div className="flex gap-[1.5mm]">
          <MapPin className="mt-[0.3mm] h-[2.5mm] w-[2.5mm] shrink-0" color={GOLD} />
          <div className="min-w-0">
            <p className="text-[5pt] font-semibold">School Address</p>
            <p className="line-clamp-2 text-[4.6pt] leading-[1.3] text-white/90">{school.address?.replace(/\s*\n\s*/g, ", ") || "—"}</p>
          </div>
        </div>
        {contacts.length > 0 && (
          <ul className="mt-[1.2mm] space-y-[0.6mm] border-t-[0.15mm] border-white/30 pt-[1.2mm] text-[4.6pt]">
            {contacts.map(({ icon: Icon, value }) => (
              <li key={value} className="flex items-center gap-[1.5mm]">
                <Icon className="h-[2.2mm] w-[2.2mm] shrink-0" color={GOLD} />
                <span className="min-w-0 truncate text-white/90">{value}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="absolute inset-x-[3mm] bottom-[1.6mm] text-center text-[3.8pt] uppercase tracking-[0.18em] text-white/80">
          If found, please return to the school
        </p>
      </div>
    </div>
  );
}
