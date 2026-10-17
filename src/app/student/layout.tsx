import type { Metadata } from "next";
import { BookOpenText, CalendarCheck, FileBarChart, GraduationCap, KeyRound, LayoutDashboard, Plane } from "lucide-react";
import { NavTracker } from "@/components/nav-tracker";
import { SchoolLogo } from "@/components/school-logo";
import { AccountCard, AppShell, type NavGroup } from "@/components/ui";
import { db } from "@/lib/db";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";
import { schoolLogoUrl } from "@/lib/school";
import { getCurrentSession } from "@/lib/sessions";
import { requireStudent } from "@/lib/student-auth";
import { getTheme } from "@/lib/theme-server";
import { studentLogout } from "../login/actions";

export const metadata: Metadata = { title: "Student Portal" };
export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: LayoutProps<"/student">) {
  const { student, school, section } = await requireStudent();
  const [session, logo, theme] = await Promise.all([
    getCurrentSession(school.id),
    db.schoolLogo.findUnique({ where: { schoolId: school.id }, select: { updatedAt: true } }),
    getTheme(),
  ]);
  const logoUrl = schoolLogoUrl({ id: school.id, logo });

  const groups: NavGroup[] = [
    {
      items: [
        { href: "/student", label: "Dashboard", icon: <LayoutDashboard />, exact: true },
        { href: "/student/attendance", label: "Attendance", icon: <CalendarCheck /> },
        { href: "/student/results", label: "Results", icon: <FileBarChart /> },
        { href: "/student/leave", label: "Leave", icon: <Plane /> },
        { href: "/student/materials", label: "Study material", icon: <BookOpenText /> },
      ],
    },
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
            Student ·<span className="rounded-md bg-accent-soft px-1.5 py-0.5 font-medium text-accent-text">{session.name}</span>
          </span>
        ),
      }}
      groups={groups}
      footerItems={[{ href: "/student/account", label: "Account", icon: <KeyRound /> }]}
      mobileTabs={["/student", "/student/attendance", "/student/results", "/student/materials"]}
      account={
        <AccountCard
          name={fullName(student)}
          detail={section ? sectionLabel(section) : student.studentCode}
          photoUrl={photoUrl(student.photoId)}
          signOut={studentLogout}
          theme={theme}
        />
      }
    >
      <NavTracker />
      {children}
    </AppShell>
  );
}
