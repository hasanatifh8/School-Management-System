import type { Metadata } from "next";
import { BookOpen, CalendarCheck, CalendarClock, CalendarDays, ClipboardList, GraduationCap, IdCard, KeyRound, LayoutDashboard, Megaphone, Plane, Users } from "lucide-react";
import { SchoolLogo } from "@/components/school-logo";
import { AccountCard, AppShell, type NavGroup } from "@/components/ui";
import { db } from "@/lib/db";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";
import { schoolLogoUrl } from "@/lib/school";
import { getCurrentSession } from "@/lib/sessions";
import { requireTeacher } from "@/lib/teacher-auth";
import { getTheme } from "@/lib/theme-server";
import { teacherLogout } from "../login/actions";

export const metadata: Metadata = { title: "Teacher Portal" };
export const dynamic = "force-dynamic";

export default async function TeacherLayout({ children }: LayoutProps<"/teacher">) {
  const ctx = await requireTeacher();
  const [session, logo, theme] = await Promise.all([
    getCurrentSession(ctx.school.id),
    db.schoolLogo.findUnique({ where: { schoolId: ctx.school.id }, select: { updatedAt: true } }),
    getTheme(),
  ]);
  const logoUrl = schoolLogoUrl({ id: ctx.school.id, logo });
  const name = fullName(ctx.teacher);

  const myClass = ctx.classSection
    ? [sectionLabel(ctx.classSection), ctx.subjectSections.find((s) => s.section.id === ctx.classSection!.id)?.subjects.join(", ")]
        .filter(Boolean)
        .join(" · ")
    : null;
  const otherSections = ctx.subjectSections.filter((s) => s.section.id !== ctx.classSection?.id);

  const groups: NavGroup[] = [
    {
      items: [
        { href: "/teacher", label: "Dashboard", icon: <LayoutDashboard />, exact: true },
        { href: "/teacher/timetable", label: "Timetable", icon: <CalendarClock /> },
        { href: "/teacher/calendar", label: "School calendar", icon: <CalendarDays /> },
        { href: "/teacher/students", label: "Students", icon: <GraduationCap /> },
        { href: "/teacher/leave", label: "Leave", icon: <Plane /> },
      ],
    },
    ...(myClass
      ? [
          {
            label: "My class",
            items: [
              { href: "/teacher/class", label: "My class", icon: <Users />, sub: myClass },
              { href: "/teacher/attendance", label: "Attendance", icon: <CalendarCheck /> },
              { href: "/teacher/notices", label: "Notices", icon: <Megaphone /> },
              { href: "/teacher/id-cards", label: "ID cards", icon: <IdCard /> },
            ],
          },
        ]
      : []),
    {
      label: "Teaching",
      items: [
        { href: "/teacher/tests", label: "Tests & exams", icon: <ClipboardList /> },
        ...otherSections.map((s) => ({
          href: `/teacher/sections/${s.section.id}`,
          label: sectionLabel(s.section),
          icon: <BookOpen />,
          sub: s.subjects.join(", "),
        })),
      ],
    },
  ];

  return (
    <AppShell
      brand={{
        logo: logoUrl ? (
          <SchoolLogo name={ctx.school.name} url={logoUrl} size="sm" />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-violet-400 text-white shadow-accent">
            <GraduationCap className="h-5 w-5" />
          </span>
        ),
        title: ctx.school.name,
        subtitle: (
          <span className="flex items-center gap-1.5">
            Teacher ·<span className="rounded-md bg-accent-soft px-1.5 py-0.5 font-medium text-accent-text">{session.name}</span>
          </span>
        ),
      }}
      groups={groups}
      footerItems={[{ href: "/teacher/account", label: "Account", icon: <KeyRound /> }]}
      mobileTabs={myClass ? ["/teacher", "/teacher/attendance", "/teacher/class", "/teacher/tests"] : ["/teacher", "/teacher/tests", "/teacher/account"]}
      account={
        <AccountCard
          name={name}
          detail={<span className="font-mono">{ctx.teacher.username}</span>}
          photoUrl={photoUrl(ctx.teacher.photoId)}
          signOut={teacherLogout}
          theme={theme}
        />
      }
    >
      {children}
    </AppShell>
  );
}
