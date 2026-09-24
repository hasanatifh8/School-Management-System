import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, LogOut, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui";
import { requirePowerAdmin } from "@/lib/power-auth";
import { powerLogout } from "../actions";
import { PowerNav } from "./power-nav";

export const metadata: Metadata = { title: "Power Admin" };
export const dynamic = "force-dynamic";

export default async function PowerLayout({ children }: LayoutProps<"/power">) {
  await requirePowerAdmin();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6 lg:px-10">
          <Link href="/power" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 shadow-lg shadow-rose-500/30">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold">Power Admin</span>
              <span className="block text-[11px] uppercase tracking-wider text-slate-500">All schools</span>
            </span>
          </Link>
          <PowerNav />
          <div className="ml-auto flex items-center gap-2">
            <Link href="/admin" className={`${buttonVariants.ghost} !text-slate-300 hover:!bg-white/10 hover:!text-white`}>
              <ExternalLink className="h-4 w-4" />
              Admin Portal
            </Link>
            <form action={powerLogout}>
              <button className={`${buttonVariants.ghost} !text-slate-300 hover:!bg-white/10 hover:!text-white`}>
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10">{children}</main>
    </div>
  );
}
