import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  Droplet,
  FileText,
  GraduationCap,
  LayoutGrid,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  RotateCcw,
  UserRound,
  UserRoundX,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar, Badge, ButtonLink, Card, PageHeader, StatCard, StatGrid, StatusTab, tabBarClass } from "@/components/ui";
import { todayISO } from "@/lib/attendance-shared";
import { BLOOD_GROUP_LABELS } from "@/lib/blood-groups";
import { db } from "@/lib/db";
import { MODE_LABELS, rupees } from "@/lib/fees-shared";
import { photoUrl } from "@/lib/photos";
import { getCurrentSchool } from "@/lib/school";
import { DocumentsPanel } from "../../documents/documents-panel";
import {
  makeCashier,
  removeCashier,
  removeStaffMember,
  resetCashierPassword,
  restoreStaffMember,
  setCashierActive,
  updateStaffMember,
} from "../actions";
import { StaffForm } from "../staff-form";
import { CashierCard } from "./cashier-card";

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const monthFormat = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
const GENDER_LABELS = { MALE: "Male", FEMALE: "Female", OTHER: "Other" } as const;

const TABS = ["overview", "edit", "documents"] as const;
type Tab = (typeof TABS)[number];

/** Whole years and months from a date until today (India), e.g. "3 yrs 2 mos". */
function durationSince(date: Date) {
  const [ty, tm, td] = todayISO().split("-").map(Number);
  let months = (ty - date.getUTCFullYear()) * 12 + (tm - 1 - date.getUTCMonth());
  if (td < date.getUTCDate()) months--;
  if (months < 1) return "New";
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y && `${y} yr${y === 1 ? "" : "s"}`, m && `${m} mo${m === 1 ? "" : "s"}`].filter(Boolean).join(" ");
}

function ageOn(dob: Date) {
  const [ty, tm, td] = todayISO().split("-").map(Number);
  const beforeBirthday = tm - 1 < dob.getUTCMonth() || (tm - 1 === dob.getUTCMonth() && td < dob.getUTCDate());
  return ty - dob.getUTCFullYear() - (beforeBirthday ? 1 : 0);
}

export default async function StaffMemberPage({ params, searchParams }: PageProps<"/admin/staff/[id]">) {
  const { id } = await params;
  const requested = (await searchParams).tab;
  const tab: Tab = TABS.find((t) => t === requested) ?? "overview";
  const school = await getCurrentSchool();
  const staff = await db.staffMember.findFirst({
    where: { id, schoolId: school.id },
    include: {
      cashierAccount: { select: { email: true, active: true, lastLoginAt: true } },
      salaryPayments: { orderBy: [{ month: "desc" }, { createdAt: "desc" }], take: 6 },
      documents: {
        orderBy: { createdAt: "desc" },
        select: { id: true, type: true, title: true, documentNumber: true, fileName: true, mimeType: true, size: true, createdAt: true },
      },
    },
  });
  if (!staff) notFound();

  const removed = staff.status === "INACTIVE";
  const base = `/admin/staff/${staff.id}`;
  const cashier = staff.cashierAccount;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Staff", href: "/admin/staff" }, { label: staff.name }]}
        leading={
          <span className="rounded-full ring-4 ring-surface">
            <Avatar name={staff.name} src={photoUrl(staff.photoId)} size="xl" />
          </span>
        }
        eyebrow={<span className="font-mono normal-case tracking-normal">{staff.employeeCode}</span>}
        title={staff.name}
        subtitle={
          <>
            <span>{[staff.designation, staff.qualification].filter(Boolean).join(" · ")}</span>
            <span className="mt-2 flex flex-wrap items-center gap-2">
              {cashier && (
                <Badge tone={cashier.active ? "amber" : "slate"}>
                  <Wallet className="h-3 w-3" />
                  {cashier.active ? "Cashier" : "Cashier (sign-in off)"}
                </Badge>
              )}
              {staff.bloodGroup && (
                <Badge tone="red">
                  <Droplet className="h-3 w-3" />
                  {BLOOD_GROUP_LABELS[staff.bloodGroup]}
                </Badge>
              )}
              {removed ? (
                <Badge tone="red" dot>
                  Removed
                </Badge>
              ) : (
                <Badge tone="green" dot>
                  Active
                </Badge>
              )}
            </span>
          </>
        }
        action={
          tab !== "edit" && (
            <ButtonLink href={`${base}?tab=edit`} icon={Pencil} variant="secondary">
              Edit profile
            </ButtonLink>
          )
        }
      />

      <div className="mb-6 border-b border-line">
        <nav aria-label="Staff member sections" className={tabBarClass}>
          <StatusTab href={base} active={tab === "overview"} label="Overview" icon={LayoutGrid} />
          <StatusTab href={`${base}?tab=edit`} active={tab === "edit"} label="Edit profile" icon={Pencil} />
          <StatusTab href={`${base}?tab=documents`} active={tab === "documents"} label="Documents" icon={FileText} count={staff.documents.length} />
        </nav>
      </div>

      {tab === "documents" && <DocumentsPanel ownerKind="staff" ownerId={staff.id} documents={staff.documents} />}

      {tab === "edit" && (
        <div className="space-y-6">
          <Card title="Edit profile" description="Changes are saved to the staff member's record.">
            <StaffForm
              action={updateStaffMember.bind(null, staff.id)}
              staff={staff}
              photoUrl={photoUrl(staff.photoId)}
              submitLabel="Save changes"
              cancelHref={base}
              isCashier={!!cashier}
            />
          </Card>
          <Card
            title={removed ? "Restore staff member" : "Remove staff member"}
            description={
              removed
                ? "Put them back on the payroll."
                : `They leave the payroll; past salaries stay on record.${cashier ? " Their cashier sign-in is turned off." : ""}`
            }
            className={removed ? undefined : "border-danger-line"}
          >
            {removed ? (
              <ActionForm action={restoreStaffMember.bind(null, staff.id)} compact className="flex items-center gap-3">
                <SubmitButton variant="secondary" icon={<RotateCcw className="h-4 w-4" />}>
                  Restore staff member
                </SubmitButton>
              </ActionForm>
            ) : (
              <ActionForm action={removeStaffMember.bind(null, staff.id)} compact className="flex items-center gap-3">
                <SubmitButton variant="danger" confirm={`Remove ${staff.name}?`} confirmMessage="They leave the payroll. Past salaries are kept." icon={<UserRoundX className="h-4 w-4" />}>
                  Remove staff member
                </SubmitButton>
              </ActionForm>
            )}
          </Card>
        </div>
      )}

      {tab === "overview" && (
        <div className="space-y-6">
          <StatGrid>
            <StatCard
              icon={CalendarDays}
              tone="emerald"
              label="At this school"
              value={staff.joiningDate ? durationSince(staff.joiningDate) : "—"}
              detail={staff.joiningDate ? `Joined ${dateFormat.format(staff.joiningDate)}` : "Joining date not added"}
            />
            <StatCard
              icon={Briefcase}
              tone="sky"
              label="Experience"
              value={staff.experienceYears == null ? "—" : `${staff.experienceYears} yr${staff.experienceYears === 1 ? "" : "s"}`}
              detail="Total work experience"
            />
            <StatCard
              icon={Wallet}
              tone="amber"
              label="Monthly salary"
              value={staff.monthlySalary == null ? "—" : rupees(staff.monthlySalary)}
              detail={staff.salaryPayments[0] ? `Last paid for ${monthFormat.format(new Date(`${staff.salaryPayments[0].month}-01`))}` : "No payments yet"}
            />
            <StatCard
              icon={FileText}
              tone="violet"
              label="Documents"
              value={String(staff.documents.length)}
              detail={staff.documents.length ? "On file" : "Resume, certificates, ID proof"}
            />
          </StatGrid>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              <div className="grid gap-6 md:grid-cols-2">
                <Card title="Personal details" icon={UserRound}>
                  <DetailList>
                    <Detail label="Full name">{staff.name}</Detail>
                    <Detail label="Gender">{staff.gender ? GENDER_LABELS[staff.gender] : null}</Detail>
                    <Detail label="Date of birth">
                      {staff.dateOfBirth && (
                        <>
                          {dateFormat.format(staff.dateOfBirth)}
                          <span className="text-muted"> · {ageOn(staff.dateOfBirth)} yrs</span>
                        </>
                      )}
                    </Detail>
                    <Detail label="Blood group">{staff.bloodGroup && BLOOD_GROUP_LABELS[staff.bloodGroup]}</Detail>
                  </DetailList>
                </Card>

                <Card title="Contact" icon={Phone}>
                  <DetailList>
                    <Detail label="Phone" icon={Phone}>
                      {staff.phone && (
                        <a href={`tel:${staff.phone}`} className="rounded text-accent-text underline-offset-4 hover:underline">
                          {staff.phone}
                        </a>
                      )}
                    </Detail>
                    <Detail label="WhatsApp" icon={MessageCircle}>
                      {staff.whatsappNumber && (
                        <a href={`https://wa.me/91${staff.whatsappNumber}`} target="_blank" rel="noreferrer" className="rounded text-accent-text underline-offset-4 hover:underline">
                          {staff.whatsappNumber}
                        </a>
                      )}
                    </Detail>
                    <Detail label="Email" icon={Mail}>
                      {staff.email && (
                        <a href={`mailto:${staff.email}`} className="break-all rounded text-accent-text underline-offset-4 hover:underline">
                          {staff.email}
                        </a>
                      )}
                    </Detail>
                    <Detail label="Address" icon={MapPin}>
                      {staff.address && <span className="whitespace-pre-line">{staff.address}</span>}
                    </Detail>
                  </DetailList>
                </Card>
              </div>

              <Card title="Job & qualification" icon={GraduationCap}>
                <DetailList columns>
                  <Detail label="Staff ID">
                    <span className="font-mono">{staff.employeeCode}</span>
                  </Detail>
                  <Detail label="Job">{staff.designation}</Detail>
                  <Detail label="Qualification / degree">{staff.qualification}</Detail>
                  <Detail label="Experience">{staff.experienceYears != null && `${staff.experienceYears} year${staff.experienceYears === 1 ? "" : "s"}`}</Detail>
                  <Detail label="Joining date">{staff.joiningDate && dateFormat.format(staff.joiningDate)}</Detail>
                  <Detail label="Monthly salary">{staff.monthlySalary != null && rupees(staff.monthlySalary)}</Detail>
                </DetailList>
              </Card>
            </div>

            <div className="space-y-6 self-start">
              <CashierCard
                name={staff.name}
                email={staff.email}
                removed={removed}
                account={cashier && { email: cashier.email, active: cashier.active, lastLoginAt: cashier.lastLoginAt ? dateTimeFormat.format(cashier.lastLoginAt) : null }}
                make={makeCashier.bind(null, staff.id)}
                reset={resetCashierPassword.bind(null, staff.id)}
                setActive={setCashierActive.bind(null, staff.id)}
                remove={removeCashier.bind(null, staff.id)}
              />

              <Card title="Recent salary" icon={Wallet} padded={false}>
                {staff.salaryPayments.length === 0 ? (
                  <p className="p-6 text-sm text-muted">No salary paid yet. Pay it from Expenses → Salaries.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {staff.salaryPayments.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 px-6 py-3 text-sm">
                        <div>
                          <p className="font-medium text-fg">{monthFormat.format(new Date(`${p.month}-01`))}</p>
                          <p className="text-xs text-muted">
                            {MODE_LABELS[p.mode]} · paid {dateFormat.format(p.paidOn)}
                          </p>
                        </div>
                        <span className="font-semibold tabular-nums text-fg">{rupees(p.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title="Documents" icon={FileText}>
                <p className="text-sm text-muted">
                  {staff.documents.length
                    ? `${staff.documents.length} document${staff.documents.length === 1 ? "" : "s"} on file.`
                    : "No documents yet. Upload their resume, degree certificates and ID proof."}
                </p>
                <Link href={`${base}?tab=documents`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent-text underline-offset-4 hover:underline">
                  {staff.documents.length ? "View documents" : "Upload documents"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Card>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DetailList({ children, columns = false }: { children: ReactNode; columns?: boolean }) {
  return <dl className={columns ? "grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>{children}</dl>;
}

/** A label and value; empty values show a muted "Not added". */
function Detail({ label, icon: Icon, children }: { label: string; icon?: LucideIcon; children: ReactNode }) {
  const empty = children == null || children === false || children === "";
  return (
    <div className="flex items-start gap-3">
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />}
      <div className="min-w-0">
        <dt className="text-eyebrow uppercase text-muted">{label}</dt>
        <dd className={`mt-0.5 break-words text-sm ${empty ? "text-subtle" : "text-fg"}`}>{empty ? "Not added" : children}</dd>
      </div>
    </div>
  );
}
