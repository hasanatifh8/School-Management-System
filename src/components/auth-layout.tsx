import type { LucideIcon } from "lucide-react";
import { CalendarCheck, Megaphone, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { PRODUCT, PoweredBy, ScholdeskLogo } from "@/components/brand";
import { SchoolLogo } from "@/components/school-logo";

const features: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: CalendarCheck, title: "Attendance in seconds", text: "Everyone starts present — tap only the exceptions." },
  { icon: Wallet, title: "Fees without the queue", text: "Find a student, collect, print the receipt." },
  { icon: Megaphone, title: "Parents in the loop", text: "WhatsApp and SMS notices from one place." },
];

/**
 * Sign-in screens: a Scholdesk brand panel on large screens (always dark,
 * like the cover of a notebook) and the form on the right, following the theme.
 */
export function AuthLayout({
  school,
  title,
  subtitle,
  children,
  footer,
}: {
  /** The school this sign-in page is for (its logo and name go above the form). */
  school?: { name: string; logoUrl: string | null } | null;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-[#0e0f12] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-[#6d60f2]/30 blur-3xl" />
        <div aria-hidden className="absolute -bottom-40 right-0 h-[26rem] w-[26rem] rounded-full bg-violet-500/20 blur-3xl" />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
        />

        <div className="relative">
          <ScholdeskLogo tone="dark" className="h-20 w-auto" priority />
          <p className="mt-3 text-sm text-white/60">{PRODUCT.tagline}.</p>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-display-sm font-semibold xl:text-display">
            Run your school,{" "}
            <span className="bg-gradient-to-r from-[#aea5fb] to-violet-300 bg-clip-text text-transparent">beautifully.</span>
          </h2>
          <ul className="mt-12 space-y-6">
            {features.map(({ icon: FIcon, title: t, text }) => (
              <li key={t} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                  <FIcon className="h-5 w-5 text-[#aea5fb]" />
                </span>
                <div>
                  <p className="font-medium">{t}</p>
                  <p className="mt-0.5 text-sm text-white/60">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-end justify-between gap-6">
          {/* Glass preview of the dashboard's key number */}
          <div className="w-72 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <p className="text-sm text-white/60">Attendance today</p>
            <p className="mt-2 text-display-sm font-semibold tabular-nums">96.4%</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[96%] rounded-full bg-gradient-to-r from-[#6d60f2] to-violet-300" />
            </div>
          </div>
          <PoweredBy tone="dark" className="text-white/60" />
        </div>
      </section>

      {/* Form */}
      <section className="flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm animate-rise">
          {school ? (
            <div className="flex items-center gap-4">
              {school.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- served from our own API route
                <img
                  src={school.logoUrl}
                  alt={`${school.name} logo`}
                  className="h-20 w-auto max-w-40 shrink-0 rounded-2xl border border-line bg-white object-contain p-2 shadow-card"
                />
              ) : (
                <SchoolLogo name={school.name} url={null} size="lg" />
              )}
              <p className="min-w-0 text-base font-semibold leading-snug text-fg">{school.name}</p>
            </div>
          ) : (
            <ScholdeskLogo className="h-16 w-auto lg:hidden" priority />
          )}
          <h1 className={`mt-8 text-h1 font-semibold text-fg ${school ? "" : "lg:mt-0"}`}>{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 border-t border-line pt-6 text-xs leading-5 text-muted">{footer}</div>}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 lg:hidden">
            {school && <ScholdeskLogo className="h-10 w-auto" />}
            <PoweredBy className="text-muted" />
          </div>
        </div>
      </section>
    </main>
  );
}
