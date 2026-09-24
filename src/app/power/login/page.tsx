import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { MIN_PASSWORD_LENGTH, hasPowerSession, powerAdminEnabled } from "@/lib/power-auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Power Admin · Sign in" };
export const dynamic = "force-dynamic";

export default async function PowerLoginPage() {
  if (await hasPowerSession()) redirect("/power");
  const enabled = powerAdminEnabled();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-lg shadow-rose-500/30">
          {enabled ? <ShieldCheck className="h-6 w-6" /> : <ShieldOff className="h-6 w-6" />}
        </span>
        <h1 className="mt-5 text-xl font-semibold text-slate-900">Power Admin</h1>
        {enabled ? (
          <>
            <p className="mt-1 mb-6 text-sm text-slate-500">Manage schools, logos and data. Sign in to continue.</p>
            <LoginForm />
          </>
        ) : (
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            <p>Power Admin is turned off because no password is set.</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Add <code className="rounded bg-slate-100 px-1">POWER_ADMIN_PASSWORD</code> (at least {MIN_PASSWORD_LENGTH}{" "}
                characters) to the environment: in Vercel under <em>Settings → Environment Variables</em>, or in{" "}
                <code className="rounded bg-slate-100 px-1">.env</code> locally.
              </li>
              <li>Redeploy (or restart the dev server), then reload this page.</li>
            </ol>
          </div>
        )}
      </div>
    </main>
  );
}
