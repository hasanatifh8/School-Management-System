import { Globe, GraduationCap, Mail, MapPin, Phone, UserRound } from "lucide-react";
import type { IdCardSchool, IdCardStudent } from "@/lib/id-cards";

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

export function IdCardFront({ school, student, validTill }: { school: IdCardSchool; student: IdCardStudent; validTill: string }) {
  const rows: [string, string][] = [
    ["Class", student.className],
    ["Section", student.sectionName],
    ["Roll No.", student.roll],
    ["Admission No.", student.admissionNo],
    ["Date of Birth", student.dob],
    ["Blood Group", student.bloodGroup],
    ["Parent Contact", student.parentContact],
  ];
  return (
    <div className={cardClass}>
      {/* Header band with a gold wave */}
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

      {/* Photo */}
      <div className="absolute left-1/2 top-[21.5mm] h-[23mm] w-[19mm] -translate-x-1/2 overflow-hidden rounded-[1.2mm] bg-sky-100 ring-[0.45mm] ring-[#0b2554]">
        {student.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={student.photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <UserRound className="h-full w-full p-[3mm] text-sky-300" />
        )}
      </div>

      <p className="absolute left-1/2 top-[46mm] w-[40mm] -translate-x-1/2 rounded-full bg-[#0b2554] py-[0.7mm] text-center text-[6.4pt] font-bold uppercase tracking-wide text-white">
        Student ID Card
      </p>

      {/* Details */}
      <div className="absolute inset-x-[3.5mm] top-[51.3mm]">
        <p className="mb-[0.6mm] truncate text-center text-[7.2pt] font-bold leading-tight">{student.name}</p>
        <dl className="w-[32.5mm] text-[5.4pt] leading-[2.85mm]">
          {rows.map(([label, value]) => (
            <div key={label} className="flex">
              <dt className="w-[14.5mm] shrink-0 font-medium text-[#0b2554]/80">{label}</dt>
              <dd className="min-w-0 flex-1 truncate border-b-[0.15mm] border-[#0b2554]/25 font-semibold">
                <span className="mr-[0.8mm] font-normal text-[#0b2554]/60">:</span>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="absolute right-[2.5mm] top-[58mm] w-[15mm] text-center">
        <div data-qr className="h-[15mm] w-[15mm] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: student.qrSvg }} />
        <p className="mt-[0.5mm] text-[3.6pt] font-medium leading-none">Scan for details</p>
      </div>

      {/* Footer band */}
      <svg className="absolute inset-x-0 bottom-0 h-[8.5mm] w-full" viewBox="0 0 54 8.5" preserveAspectRatio="none" aria-hidden>
        <path d="M0 1.2C16 -0.4 34 3.4 54 1.6V8.5H0Z" fill={GOLD} />
        <path d="M0 2.4C16 0.8 34 4.6 54 2.8V8.5H0Z" fill={NAVY} />
      </svg>
      <p className="absolute inset-x-0 bottom-[1.9mm] text-center text-[4.6pt] font-medium uppercase tracking-[0.2em] text-white">
        Valid till : {validTill}
      </p>
    </div>
  );
}

export function IdCardBack({ school }: { school: IdCardSchool }) {
  const contacts = [
    { icon: Phone, label: "Contact No.", value: school.phone },
    { icon: Mail, label: "Email", value: school.email },
    { icon: Globe, label: "Website", value: school.website?.replace(/^https?:\/\//, "") },
  ].filter((c) => c.value);
  return (
    <div className={cardClass}>
      <span className="absolute left-1/2 top-[1.8mm] h-[2mm] w-[10mm] -translate-x-1/2 rounded-full bg-slate-200" />
      {/* Faint watermark */}
      <div className="absolute left-1/2 top-[24mm] h-[24mm] w-[24mm] -translate-x-1/2 opacity-[0.06] grayscale">
        <Logo school={school} size="h-full w-full" />
      </div>
      <div className="relative flex flex-col items-center px-[4mm] pt-[7mm] text-center">
        <Logo school={school} size="h-[15mm] w-[15mm]" />
        <p className={`mt-[2mm] font-extrabold uppercase leading-[1.05] tracking-wide ${nameSize(school.name)}`}>{school.name}</p>
        <Motto text={school.motto} className="mt-[1mm] max-w-full text-[#0b2554]/80" />
      </div>

      <div className="absolute right-[4mm] top-[36.5mm] w-[20mm] text-center">
        <div className="h-[5mm] border-b-[0.2mm] border-[#0b2554]/50" />
        <p className="mt-[0.5mm] text-[4.2pt] font-medium text-[#0b2554]/70">Principal</p>
        {school.principalName && <p className="truncate text-[4pt] text-[#0b2554]/60">{school.principalName}</p>}
      </div>

      <svg className="absolute inset-x-0 bottom-0 h-[40mm] w-full" viewBox="0 0 54 40" preserveAspectRatio="none" aria-hidden>
        <path d="M0 5.5C18 7.5 36 4 54 0.6V2.2C36 5.6 18 9.1 0 7.1Z" fill={GOLD} />
        <path d="M0 7.1C18 9.1 36 5.6 54 2.2V40H0Z" fill={NAVY} />
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-[32mm] px-[4mm] pt-[1mm] text-white">
        {school.address && (
          <div className="flex gap-[1.5mm]">
            <MapPin className="mt-[0.3mm] h-[2.6mm] w-[2.6mm] shrink-0" color={GOLD} />
            <div className="min-w-0">
              <p className="text-[5.2pt] font-semibold">School Address</p>
              <p className="line-clamp-3 whitespace-pre-line text-[4.8pt] leading-[1.3] text-white/90">{school.address}</p>
            </div>
          </div>
        )}
        {contacts.length > 0 && (
          <dl className="mt-[1.6mm] space-y-[0.9mm] border-t-[0.15mm] border-white/30 pt-[1.6mm] text-[4.8pt]">
            {contacts.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-[1.5mm]">
                <Icon className="h-[2.3mm] w-[2.3mm] shrink-0" color={GOLD} />
                <dt className="w-[11mm] shrink-0 font-semibold">{label}</dt>
                <dd className="min-w-0 truncate text-white/90">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="absolute inset-x-[3mm] bottom-[2mm] text-center text-[3.8pt] uppercase tracking-[0.18em] text-white/80">
          If found, please return to the school
        </p>
      </div>
    </div>
  );
}
