import Link from "next/link";
import { ArrowLeftRight, GraduationCap, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { SchoolLogo } from "@/components/school-logo";
import { Avatar } from "@/components/ui";
import { db } from "@/lib/db";
import { getCurrentSchool, getViewer, schoolLogoUrl } from "@/lib/school";
import { adminLogout } from "../login/actions";
import { getCurrentSession } from "@/lib/sessions";
import { AdminNav } from "./admin-nav";

// Admin pages always show live data from the database.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const school = await getCurrentSchool();
  const viewer = (await getViewer())!; // getCurrentSchool already redirected anonymous visitors
  const [session, logo, activeSchools] = await Promise.all([
    getCurrentSession(school.id),
    db.schoolLogo.findUnique({ where: { schoolId: school.id }, select: { updatedAt: true } }),
    db.school.count({ where: { status: "ACTIVE" } }),
  ]);
  const logoUrl = schoolLogoUrl({ id: school.id, logo });
  return (
    <div className="min-h-screen lg:flex">
      {/* Top bar on mobile; full-height sidebar on desktop with pinned contents. */}
      <aside className="z-30 bg-slate-950 print:hidden lg:w-64 lg:shrink-0">
        <div className="flex flex-col lg:sticky lg:top-0 lg:h-screen">
          <div className="flex items-center gap-3 px-5 py-4 lg:py-6">
            {logoUrl ? (
              <SchoolLogo name={school.name} url={logoUrl} size="sm" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30">
                <GraduationCap className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{school.name}</p>
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Admin Portal ·
                <Link
                  href="/admin/sessions"
                  title="Current academic session"
                  className="rounded bg-white/10 px-1.5 py-0.5 normal-case tracking-normal text-indigo-200 hover:bg-white/15"
                >
                  {session.name}
                </Link>
              </p>
            </div>
          </div>

          <div className="px-3 pb-3 lg:flex-1 lg:pb-0">
            <p className="mb-2 hidden px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600 lg:block">
              Manage
            </p>
            <AdminNav />
          </div>

          {/* Who is signed in */}
          <div className="border-t border-white/5 p-4">
            {viewer.kind === "power" && (
              <div className="mb-3 hidden space-y-1 lg:block">
                {activeSchools > 1 && (
                  <Link href="/power" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-white/5 hover:text-white">
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    Switch school
                  </Link>
                )}
                <Link href="/power" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-white/5 hover:text-white">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Power Admin
                </Link>
              </div>
            )}
            <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
              <Avatar name={viewer.kind === "admin" ? viewer.admin.name : "Power Admin"} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-200">
                  {viewer.kind === "admin" ? viewer.admin.name : "Power Admin"}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {viewer.kind === "admin" ? viewer.admin.email : "Viewing this school"}
                </p>
              </div>
              {viewer.kind === "admin" && (
                <form action={adminLogout}>
                  <button title="Sign out" aria-label="Sign out" className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
                    <LogOut className="h-4 w-4" />
                  </button>
                </form>
              )}
            </div>
            {viewer.kind === "admin" && (
              <Link href="/admin/account" className="mt-2 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-white/5 hover:text-white">
                <KeyRound className="h-3.5 w-3.5" />
                Account &amp; password
              </Link>
            )}
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        {viewer.kind === "power" && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-50 print:hidden px-4 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200 sm:px-6 lg:px-10">
            <span>
              Viewing <strong>{school.name}</strong> as Power Admin.
            </span>
            <Link href="/power" className="font-medium underline">
              Back to Power Admin
            </Link>
          </div>
        )}
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10 print:max-w-none print:p-0">{children}</div>
      </main>
    </div>
  );
}
