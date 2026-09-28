import type { LucideIcon } from "lucide-react";
import { CalendarCheck, Languages, Lock, Megaphone, MessageCircle, ShieldCheck, Sparkles, Wallet } from "lucide-react";
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
    <main id="main" className="grid min-h-dvh lg:grid-cols-[1.15fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-[#0e0f12] text-white lg:flex lg:flex-col lg:gap-10 lg:p-10 xl:p-14">
        <div aria-hidden className="absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-[#6d60f2]/30 blur-3xl" />
        <div aria-hidden className="absolute -bottom-48 -right-24 h-[30rem] w-[30rem] rounded-full bg-violet-500/20 blur-3xl" />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]"
        />

        <header className="relative flex items-center justify-between gap-6">
          <ScholdeskLogo tone="dark" className="h-14 w-auto" priority />
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-white/40">{PRODUCT.tagline}</span>
        </header>

        <div className="relative flex flex-1 flex-col justify-center gap-10">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1 pl-1 pr-3 text-xs font-medium text-white/80 backdrop-blur">
              <span className="rounded-full bg-gradient-to-r from-[#6d60f2] to-violet-400 px-2 py-0.5 font-semibold text-white">New</span>
              AI-powered school management
            </p>
            <h2 className="mt-6 text-display-sm font-semibold xl:text-display">
              Less paperwork.
              <br />
              <span className="bg-gradient-to-r from-[#aea5fb] to-violet-300 bg-clip-text text-transparent">More teaching.</span>
            </h2>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-white/65">
              Attendance, fees, exams and parent messaging in one place, with an AI assistant that answers from your school&apos;s own records.
            </p>

            <ul className="mt-8 flex flex-wrap gap-2">
              {features.map(({ icon: FIcon, title: t }) => (
                <li key={t} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] py-1.5 pl-1.5 pr-3.5 text-sm font-medium text-white/85">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#6d60f2]/60 to-violet-500/30">
                    <FIcon className="h-3.5 w-3.5 text-white" aria-hidden />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <ProductPreview />
        </div>

        <footer className="relative flex flex-wrap items-end justify-between gap-6 border-t border-white/10 pt-6">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/55">
            {trust.map(({ icon: TIcon, label }) => (
              <li key={label} className="inline-flex items-center gap-1.5">
                <TIcon className="h-3.5 w-3.5 text-[#aea5fb]" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
          <PoweredBy tone="dark" className="text-white/50" />
        </footer>
      </section>

      {/* Form */}
      <section className="relative flex items-center justify-center overflow-hidden px-4 py-12 sm:px-6">
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-violet-400/10 blur-3xl" />
        <div className="relative w-full max-w-md animate-rise">
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
          {/* The brand panel is hidden on phones; keep the AI message visible there. */}
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-text lg:hidden">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Now with Ask AI: answers from your school&apos;s data
          </p>

          <div className={`rounded-3xl border border-line bg-surface p-6 shadow-lift sm:p-8 ${school ? "mt-8" : "mt-6 lg:mt-0"}`}>
            <h1 className="text-h1 font-semibold text-fg">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-subtle">
              <Lock className="h-3.5 w-3.5" aria-hidden /> Secure sign-in. Your school&apos;s data stays private.
            </p>
          </div>

          {footer && <div className="mt-6 px-2 text-xs leading-5 text-muted">{footer}</div>}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 px-2 lg:hidden">
            {school && <ScholdeskLogo className="h-10 w-auto" />}
            <PoweredBy className="text-muted" />
          </div>
        </div>
      </section>
    </main>
  );
}

/**
 * A product shot: a dashboard card with the Ask AI chat floating over it.
 * The chat plays once (question, typing dots, answer); CSS only, and with
 * reduced motion the answer simply shows. Figures are illustrative.
 */
function ProductPreview() {
  return (
    <div className="relative h-[17.5rem] w-[24rem] max-w-full shrink-0 [@media(max-height:859px)]:hidden" aria-label="Example: the dashboard and the AI assistant answering a question about pending fees">
      {/* Dashboard card, behind */}
      <div className="absolute left-0 top-0 w-72 rotate-[-3deg] rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-xl">
        <p className="text-xs font-medium uppercase tracking-wide text-white/45">Today</p>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-white/55">Attendance</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">96.4%</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[96%] rounded-full bg-gradient-to-r from-[#6d60f2] to-violet-300" />
            </div>
          </div>
          <div>
            <p className="text-xs text-white/55">Fees collected</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">₹42,300</p>
            <div className="mt-2 flex h-5 items-end gap-0.5" aria-hidden>
              {[35, 55, 40, 70, 50, 85, 100].map((h, i) => (
                <span key={i} className="flex-1 rounded-sm bg-gradient-to-t from-[#6d60f2] to-violet-300" style={{ height: `${h}%`, opacity: 0.45 + i * 0.08 }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Ask AI chat, in front */}
      <div className="absolute bottom-0 right-0 w-72 rounded-2xl border border-white/15 bg-[#17181f]/90 p-4 shadow-2xl ring-1 ring-[#6d60f2]/20 backdrop-blur-xl">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/50">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-[#6d60f2] to-violet-400">
            <Sparkles className="h-3 w-3 text-white" aria-hidden />
          </span>
          Ask AI
        </p>
        <p className="ml-auto mt-3 w-fit max-w-[90%] animate-rise rounded-2xl rounded-br-md bg-[#6d60f2] px-3 py-2 text-sm" style={{ animationDelay: "400ms" }}>
          Who hasn&apos;t paid fees this month?
        </p>
        <div className="mt-2.5 grid">
          {/* Typing dots, replaced by the answer in the same spot. */}
          <span className="col-start-1 row-start-1 flex h-9 w-14 items-center justify-center gap-1 self-start rounded-2xl rounded-tl-md bg-white/10 [animation:fade-in_250ms_ease-out_900ms_both,fade-in_250ms_ease-out_2300ms_reverse_forwards]" aria-hidden>
            {[0, 150, 300].map((d) => (
              <span key={d} className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/70" style={{ animationDelay: `${d}ms` }} />
            ))}
          </span>
          <div className="col-start-1 row-start-1 animate-rise rounded-2xl rounded-tl-md bg-white/10 px-3 py-2.5 text-sm text-white/85" style={{ animationDelay: "2500ms" }}>
            <p>
              <strong className="font-semibold text-white">14 students</strong> have <strong className="font-semibold text-white">₹86,400</strong> pending. Most are in Class 8 – B.
            </p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs text-[#cfc9fd]">
              <Megaphone className="h-3 w-3" aria-hidden /> Send a fee reminder
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
