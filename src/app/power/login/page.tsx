import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth-layout";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { MIN_PASSWORD_LENGTH, hasPowerSession, powerAdminEnabled } from "@/lib/power-auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Power Admin · Sign in" };
export const dynamic = "force-dynamic";

export default async function PowerLoginPage() {
  if (await hasPowerSession()) redirect("/power");
  const enabled = powerAdminEnabled();

  return (
    <AuthLayout
      icon={enabled ? ShieldCheck : ShieldOff}
      title="Power Admin"
      subtitle={enabled ? "Manage schools, logos and data. Sign in to continue." : "Power Admin is turned off because no password is set."}
      footer={
        <Link href="/login" className="font-medium text-fg-2 underline-offset-4 hover:text-accent-text hover:underline">
          ← School admin or teacher sign-in
        </Link>
      }
    >
      {enabled ? (
        <LoginForm />
      ) : (
        <ol className="list-decimal space-y-2 rounded-2xl border border-line bg-surface p-6 pl-10 text-sm text-fg-2 shadow-card">
          <li>
            Add <code className="rounded bg-surface-3 px-1">POWER_ADMIN_PASSWORD</code> (at least {MIN_PASSWORD_LENGTH} characters) to
            the environment: in Vercel under <em>Settings → Environment Variables</em>, or in{" "}
            <code className="rounded bg-surface-3 px-1">.env</code> locally.
          </li>
          <li>Redeploy (or restart the dev server), then reload this page.</li>
        </ol>
      )}
    </AuthLayout>
  );
}
