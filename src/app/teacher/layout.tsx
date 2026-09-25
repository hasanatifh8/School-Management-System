import type { Metadata } from "next";
import { GraduationCap, LogOut } from "lucide-react";
import { SchoolLogo } from "@/components/school-logo";
import { Avatar } from "@/components/ui";
import { db } from "@/lib/db";
import { photoUrl } from "@/lib/photos";
import { fullName, sectionLabel } from "@/lib/queries";
import { schoolLogoUrl } from "@/lib/school";
import { getCurrentSession } from "@/lib/sessions";
import { requireTeacher } from "@/lib/teacher-auth";
import { teacherLogout } from "../login/actions";
import { TeacherNav } from "./teacher-nav";

export const metadata: Metadata = { title: "Teacher Portal" };
export const dynamic = "force-dynamic";

export default async function TeacherLayout({ children }: LayoutProps<"/teacher">) {
  const ctx = await requireTeacher();
  const [session, logo] = await Promise.all([
    getCurrentSession(ctx.school.id),
    db.schoolLogo.findUnique({ where: { schoolId: ctx.school.id }, select: { updatedAt: true } }),
  ]);
  const logoUrl = schoolLogoUrl({ id: ctx.school.id, logo });
  const name = fullName(ctx.teacher);

  return (
    <div className="min-h-screen lg:flex">
      <aside className="z-30 bg-slate-950 lg:w-64 lg:shrink-0">
        <div className="flex flex-col lg:sticky lg:top-0 lg:h-screen">
          <div className="flex items-center gap-3 px-5 py-4 lg:py-6">
            {logoUrl ? (
              <SchoolLogo name={ctx.school.name} url={logoUrl} size="sm" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/30">
                <GraduationCap className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{ctx.school.name}</p>
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                <span className="whitespace-nowrap">Teacher Portal</span>
                <span className="whitespace-nowrap rounded bg-white/10 px-1.5 py-0.5 normal-case tracking-normal text-teal-200">{session.name}</span>
              </p>
            </div>
          </div>

          <div className="px-3 pb-3 lg:flex-1 lg:overflow-y-auto lg:pb-0">
            <TeacherNav
              myClass={ctx.classSection ? sectionLabel(ctx.classSection) : null}
              subjectSections={ctx.subjectSections
                .filter((s) => s.section.id !== ctx.classSection?.id)
                .map((s) => ({ id: s.section.id, label: sectionLabel(s.section), subjects: s.subjects.join(", ") }))}
            />
          </div>

          <div className="border-t border-white/5 p-4">
            <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
              <Avatar name={name} src={photoUrl(ctx.teacher.photoId)} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-200">{name}</p>
                <p className="truncate font-mono text-xs text-slate-500">{ctx.teacher.username}</p>
              </div>
              <form action={teacherLogout}>
                <button title="Sign out" aria-label="Sign out" className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
