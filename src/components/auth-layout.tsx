import type { LucideIcon } from "lucide-react";
import { BadgeCheck, CalendarCheck, Languages, Lock, Megaphone, MessageCircle, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { PRODUCT, PoweredBy, ScholdeskLogo } from "@/components/brand";
import { SchoolLogo } from "@/components/school-logo";

const features: { icon: LucideIcon; title: string }[] = [
  { icon: Sparkles, title: "Ask AI" },
  { icon: CalendarCheck, title: "Attendance" },
  { icon: Wallet, title: "Fees & receipts" },
  { icon: Megaphone, title: "Parent notices" },
];

const trust: { icon: LucideIcon; label: string }[] = [
  { icon: ShieldCheck, label: "Role-based access" },
  { icon: Languages, label: "English & Hindi" },
  { icon: MessageCircle, label: "WhatsApp & SMS" },
];

const badges: { icon: LucideIcon; label: string }[] = [
  { icon: Lock, label: "SSL" },
  { icon: ShieldCheck, label: "Data protection" },
  { icon: BadgeCheck, label: "Secure" },
];

/**
 * Sign-in screens: a deep indigo Scholdesk brand panel on large screens
 * (always dark) and the form on the right, following the theme.
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
    <main id="main" className="grid min-h-dvh lg:grid-cols-[1.45fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-[linear-gradient(135deg,#0c0a24_0%,#17123f_45%,#2a1b5e_100%)] text-white lg:flex lg:flex-col lg:gap-10 lg:p-12 xl:p-16 short:gap-6 short:py-8 shorter:gap-4 shorter:py-6">
        <div aria-hidden className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-[#4f46e5]/25 blur-3xl" />
        <div aria-hidden className="absolute -bottom-56 right-0 h-[36rem] w-[36rem] rounded-full bg-violet-500/20 blur-3xl" />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]"
        />
        {/* Circuit illustration, behind the copy on the right. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative static SVG */}
        <img
          src="/brand/ai-circuit.svg"
          alt=""
          aria-hidden
          className="pointer-events-none absolute right-[-12rem] top-[42%] w-[32rem] -translate-y-1/2 opacity-30 xl:right-[-9rem] 2xl:right-[-4rem] 2xl:w-[38rem]"
        />

        <header className="relative flex items-center gap-8">
          <ScholdeskLogo tone="dark" className="h-20 w-auto xl:h-24 short:h-16 shorter:h-14" priority />
          <span aria-hidden className="h-16 w-px bg-white/20 shorter:h-12" />
          <span className="max-w-[16rem] text-sm font-medium uppercase leading-relaxed shorter:text-xs tracking-[0.2em] text-indigo-100/70">{PRODUCT.tagline}</span>
        </header>

        <div className="relative flex flex-1 flex-col justify-center">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1 pl-1 pr-3.5 text-sm font-medium text-white/85 backdrop-blur">
            <span className="rounded-full bg-gradient-to-r from-[#6d60f2] to-violet-400 px-2.5 py-0.5 font-semibold text-white">New</span>
            AI-powered school management
          </p>
          <h2 className="mt-7 text-6xl font-bold leading-[1.02] tracking-tight xl:text-7xl 2xl:text-[5.5rem] short:mt-5 short:text-6xl shorter:mt-4 shorter:text-5xl">
            Less paperwork.
            <br />
            <span className="bg-gradient-to-r from-[#c4b5fd] via-[#a5b4fc] to-[#818cf8] bg-clip-text text-transparent">More teaching.</span>
          </h2>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/65 short:mt-4 short:text-base">
            Attendance, fees, exams and parent messaging in one place, with an AI assistant that answers from your school&apos;s own records.
          </p>

          <ul className="mt-10 grid max-w-2xl grid-cols-2 gap-4 short:mt-6 short:gap-3 shorter:mt-5">
            {features.map(({ icon: FIcon, title: t }) => (
              <li
                key={t}
                className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-lg font-medium short:py-2.5 short:text-base text-white/90 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.09]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center short:h-8 short:w-8 justify-center rounded-full bg-gradient-to-br from-[#6d60f2]/60 to-violet-500/25 ring-1 ring-white/10">
                  <FIcon className="h-[1.125rem] w-[1.125rem] text-white" aria-hidden />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <footer className="relative flex flex-wrap items-end justify-between gap-6 border-t border-white/10 pt-6 short:pt-4">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/55">
            {trust.map(({ icon: TIcon, label }) => (
              <li key={label} className="inline-flex items-center gap-1.5">
                <TIcon className="h-4 w-4 text-[#aea5fb]" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
          <PoweredBy tone="dark" className="text-white/50" />
        </footer>
      </section>

      {/* Form */}
      <section className="relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-accent-soft/70 via-canvas to-accent-soft/50 px-4 py-12 sm:px-6 lg:short:py-6 lg:shorter:py-4">
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-violet-400/10 blur-3xl" />
        <div className="relative w-full max-w-md animate-rise">
          {school ? (
            <div className="flex items-center gap-5 rounded-3xl border border-line bg-surface/80 p-5 shadow-lift backdrop-blur lg:short:gap-4 lg:short:p-3.5 lg:shorter:p-2.5">
              {school.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- served from our own API route
                <img
                  src={school.logoUrl}
                  alt={`${school.name} logo`}
                  className="h-16 w-auto max-w-32 shrink-0 rounded-2xl lg:short:h-12 bg-white object-contain p-1"
                />
              ) : (
                <SchoolLogo name={school.name} url={null} size="lg" />
              )}
              <p className="min-w-0 text-lg font-semibold leading-snug text-fg">{school.name}</p>
            </div>
          ) : (
            <ScholdeskLogo className="h-16 w-auto lg:hidden" priority />
          )}
          {/* The brand panel is hidden on phones; keep the AI message visible there. */}
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-text lg:hidden">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Now with Ask AI: answers from your school&apos;s data
          </p>

          <div className={`rounded-3xl border border-line bg-surface p-6 shadow-pop sm:p-9 lg:short:p-7 lg:shorter:px-7 lg:shorter:py-4 ${school ? "mt-6 lg:short:mt-4 lg:shorter:mt-3" : "mt-6 lg:mt-0"}`}>
            <h1 className="text-3xl font-bold tracking-tight text-fg lg:shorter:text-2xl">{title}</h1>
            {subtitle && <p className="mt-2 text-base text-muted">{subtitle}</p>}
            <div className="mt-7 lg:short:mt-5 lg:shorter:mt-4">{children}</div>
            <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted lg:short:mt-4">
              <Lock className="h-3.5 w-3.5" aria-hidden /> Secure sign-in. Your school&apos;s data stays private.
            </p>
            <ul className="mt-4 flex flex-wrap justify-center gap-2 lg:short:mt-3">
              {badges.map(({ icon: BIcon, label }) => (
                <li key={label} className="inline-flex items-center gap-1.5 rounded-lg bg-surface-3 px-3 py-1.5 text-xs font-medium text-fg-2">
                  <BIcon className="h-3.5 w-3.5 text-accent-text" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          {footer && <div className="mt-6 lg:short:mt-4 lg:shorter:mt-3 px-2 text-xs leading-5 text-muted">{footer}</div>}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 px-2 lg:hidden">
            {school && <ScholdeskLogo className="h-10 w-auto" />}
            <PoweredBy className="text-muted" />
          </div>
        </div>
      </section>
    </main>
  );
}
