import { GraduationCap } from "lucide-react";
import { Avatar } from "@/components/ui";
import { getCurrentSchool } from "@/lib/school";
import { AdminNav } from "./admin-nav";

// Admin pages always show live data from the database.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const school = await getCurrentSchool();
  return (
    <div className="min-h-screen lg:flex">
      {/* Top bar on mobile; full-height sidebar on desktop with pinned contents. */}
      <aside className="sticky top-0 z-30 bg-slate-950 lg:static lg:w-64 lg:shrink-0">
        <div className="flex flex-col lg:sticky lg:top-0 lg:h-screen">
          <div className="flex items-center gap-3 px-5 py-4 lg:py-6">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{school.name}</p>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Admin Portal</p>
            </div>
          </div>

          <div className="px-3 pb-3 lg:flex-1 lg:pb-0">
            <p className="mb-2 hidden px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600 lg:block">
              Manage
            </p>
            <AdminNav />
          </div>

          {/* Signed-in user (placeholder until authentication is added) */}
          <div className="hidden border-t border-white/5 p-4 lg:block">
            <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
              <Avatar name="School Admin" size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-200">School Admin</p>
                <p className="truncate text-xs text-slate-500">Administrator</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
