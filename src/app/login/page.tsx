import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { getViewer } from "@/lib/school";
import { AdminLoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · School Management System" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getViewer()) redirect("/admin");
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white p-8 shadow-xl shadow-slate-900/5">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30">
          <GraduationCap className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-slate-900">Admin Portal</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500">Sign in with the account your Power Admin created for your school.</p>
        <AdminLoginForm />
        <p className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-400">
          Forgot your password? Ask your Power Admin to reset it.{" "}
          <Link href="/power/login" className="text-slate-500 hover:text-indigo-600">
            Power Admin
          </Link>
        </p>
      </div>
    </main>
  );
}
