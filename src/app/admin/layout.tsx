import Link from "next/link";
import {
  ArrowLeftRight,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  GraduationCap,
  IdCard,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  PiggyBank,
  Presentation,
  School,
  Settings,
  Shield,
  ShieldCheck,
  UserCog,
  Wallet,
} from "lucide-react";
import { SchoolLogo } from "@/components/school-logo";
import { AccountCard, AppShell, type NavGroup, type NavItem } from "@/components/ui";
import { db } from "@/lib/db";
import { getPortalSchool, getViewer, schoolLogoUrl } from "@/lib/school";
import { getCurrentSession } from "@/lib/sessions";
import { getTheme } from "@/lib/theme-server";
import { adminLogout } from "../login/actions";

// Admin pages always show live data from the database.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Each page checks access itself (fees staff may only open Fees pages).
  const school = await getPortalSchool();
  const viewer = (await getViewer())!; // getPortalSchool already redirected anonymous visitors
  const feesOnly = viewer.kind === "admin" && viewer.admin.role !== "ADMIN";
  const [session, logo, activeSchools, theme] = await Promise.all([
    getCurrentSession(school.id),
    db.schoolLogo.findUnique({ where: { schoolId: school.id }, select: { updatedAt: true } }),
    db.school.count({ where: { status: "ACTIVE" } }),
    getTheme(),
  ]);
  const logoUrl = schoolLogoUrl({ id: school.id, logo });

  const fees: NavItem = { href: "/admin/fees", label: "Fees", icon: <Wallet /> };
  const groups: NavGroup[] = feesOnly
    ? [{ items: [fees] }]
    : [
        { items: [{ href: "/admin", label: "Dashboard", icon: <LayoutDashboard />, exact: true }] },
        {
          label: "Daily",
          items: [
            { href: "/admin/attendance", label: "Attendance", icon: <CalendarCheck /> },
            fees,
            { href: "/admin/notices", label: "Notices", icon: <Megaphone /> },
          ],
        },
        {
          label: "People",
          items: [
            { href: "/admin/students", label: "Students", icon: <GraduationCap /> },
            { href: "/admin/teachers", label: "Teachers", icon: <Presentation /> },
            { href: "/admin/staff", label: "Staff", icon: <UserCog /> },
          ],
        },
        {
          label: "Academics",
          items: [
            { href: "/admin/classes", label: "Classes", icon: <School /> },
            { href: "/admin/subjects", label: "Subjects", icon: <BookOpen /> },
            { href: "/admin/timetable", label: "Timetable", icon: <CalendarClock /> },
            { href: "/admin/calendar", label: "School calendar", icon: <CalendarDays /> },
            { href: "/admin/exams", label: "Exams & tests", icon: <ClipboardList /> },
            { href: "/admin/houses", label: "Houses", icon: <Shield /> },
          ],
        },
        {
          label: "Office",
          items: [
            { href: "/admin/expenses", label: "Expenses", icon: <PiggyBank /> },
            { href: "/admin/id-cards", label: "ID cards", icon: <IdCard /> },
            { href: "/admin/sessions", label: "Sessions", icon: <CalendarRange /> },
          ],
        },
      ];
  const footerItems: NavItem[] = [
    ...(viewer.kind === "power"
      ? [
          activeSchools > 1
            ? { href: "/power", label: "Switch school", icon: <ArrowLeftRight />, exact: true }
            : { href: "/power", label: "Power Admin", icon: <ShieldCheck />, exact: true },
        ]
      : []),
    feesOnly
      ? { href: "/admin/account", label: "Account", icon: <KeyRound /> }
      : { href: "/admin/settings", label: "Settings", icon: <Settings />, alsoActive: ["/admin/account"] },
  ];

  return (
    <AppShell
      brand={{
        logo: logoUrl ? (
          <SchoolLogo name={school.name} url={logoUrl} size="sm" />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-violet-400 text-white shadow-accent">
            <GraduationCap className="h-5 w-5" />
          </span>
        ),
        title: school.name,
        subtitle: (
          <span className="flex items-center gap-1.5">
            {feesOnly ? "Fees" : "Admin"} ·
            {feesOnly ? (
              <span>{session.name}</span>
            ) : (
              <Link href="/admin/sessions" title="Current academic session" className="rounded-md bg-accent-soft px-1.5 py-0.5 font-medium text-accent-text transition hover:bg-accent/20">
                {session.name}
              </Link>
            )}
          </span>
        ),
      }}
      groups={groups}
      footerItems={footerItems}
      mobileTabs={feesOnly ? ["/admin/fees", "/admin/account"] : ["/admin", "/admin/students", "/admin/attendance", "/admin/fees"]}
      account={
        <AccountCard
          name={viewer.kind === "admin" ? viewer.admin.name : "Power Admin"}
          detail={viewer.kind === "admin" ? viewer.admin.email : "Viewing this school"}
          signOut={viewer.kind === "admin" ? adminLogout : undefined}
          theme={theme}
        />
      }
      banner={
        viewer.kind === "power" && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-warning-line bg-warning-soft px-4 py-2 text-sm text-fg sm:px-6 lg:px-10 print:hidden">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-warning" aria-hidden />
              Viewing <strong className="font-semibold">{school.name}</strong> as Power Admin.
            </span>
            <Link href="/power" className="font-medium text-warning underline-offset-4 hover:underline">
              Back to Power Admin
            </Link>
          </div>
        )
      }
    >
      {children}
    </AppShell>
  );
}
