import type { LucideIcon } from "lucide-react";
import { CalendarCheck, Megaphone, Sparkles, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { PRODUCT, PoweredBy, ScholdeskLogo } from "@/components/brand";
import { SchoolLogo } from "@/components/school-logo";

const features: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Sparkles, title: "Ask your school anything", text: "AI answers from your own records, in English or Hindi." },
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
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1 pl-1 pr-3 text-xs font-medium text-white/80 backdrop-blur">
            <span className="rounded-full bg-gradient-to-r from-[#6d60f2] to-violet-400 px-2 py-0.5 font-semibold text-white">New</span>
            AI-powered school management
          </p>
          <h2 className="text-display-sm font-semibold xl:text-display">
            Run your school,{" "}
            <span className="bg-gradient-to-r from-[#aea5fb] to-violet-300 bg-clip-text text-transparent">beautifully.</span>
          </h2>
          <ul className="mt-10 space-y-5">
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
          <AskAiPreview />
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
          {/* The brand panel is hidden on phones; keep the AI message visible there. */}
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-text lg:hidden">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Now with Ask AI: answers from your school&apos;s data
          </p>
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

/**
 * A glass card that plays a short Ask AI exchange: the question, typing dots,
 * then the answer. CSS only; with reduced motion the answer simply shows.
 */
function AskAiPreview() {
  return (
    <div className="w-80 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl" aria-label="Example: asking the AI assistant about pending fees">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/50">
        <Sparkles className="h-3.5 w-3.5 text-[#aea5fb]" aria-hidden /> Ask AI
      </p>
      <p className="ml-auto mt-3 w-fit max-w-[90%] animate-rise rounded-2xl rounded-br-md bg-[#6d60f2] px-3 py-2 text-sm" style={{ animationDelay: "400ms" }}>
        Who hasn&apos;t paid fees this month?
      </p>
      <div className="mt-3 grid">
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
  );
}
