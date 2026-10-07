import Link from "next/link";
import {
  Bell,
  BookOpen,
  CalendarDays,
  CalendarOff,
  CalendarRange,
  ChevronRight,
  School,
  IdCard,
  KeyRound,
  ListTree,
  MessageCircle,
  Palette,
  Shield,
  Target,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { Card, IconTile, PageHeader, ThemeToggle, type IconTone } from "@/components/ui";
import { getCurrentSchool, getViewer } from "@/lib/school";
import { getTheme } from "@/lib/theme-server";

type Item = { href: string; icon: LucideIcon; tone: IconTone; title: string; text: string };

const groups: { title: string; items: Item[] }[] = [
  {
    title: "School",
    items: [
      { href: "/admin/settings/school", icon: School, tone: "sky", title: "School details", text: "Name, logo, UDISE, affiliation and contacts" },
    ],
  },
  {
    title: "School year",
    items: [
      { href: "/admin/sessions", icon: CalendarRange, tone: "indigo", title: "Academic sessions", text: "Current session, next year and promotions" },
      { href: "/admin/attendance/holidays", icon: CalendarOff, tone: "violet", title: "School holidays", text: "Days no class takes attendance" },
      { href: "/admin/calendar", icon: CalendarDays, tone: "teal", title: "School calendar", text: "Plan exams, events and holidays for the year" },
      { href: "/admin/timetable/periods", icon: Bell, tone: "amber", title: "Bell schedule", text: "Periods, breaks and school days" },
      { href: "/admin/subjects", icon: BookOpen, tone: "sky", title: "Subjects", text: "Subjects offered across the school" },
      { href: "/admin/houses", icon: Shield, tone: "rose", title: "Houses", text: "Red, Green… and their members" },
      { href: "/admin/id-cards/settings", icon: IdCard, tone: "indigo", title: "ID card back", text: "Emergency contacts and guidelines on every card" },
    ],
  },
  {
    title: "Money",
    items: [
      { href: "/admin/fees/structure", icon: ListTree, tone: "emerald", title: "Fee structure", text: "Fee heads and amounts per class" },
      { href: "/admin/expenses/budget", icon: Target, tone: "amber", title: "Monthly budgets", text: "Spending limits by category" },
    ],
  },
  {
    title: "People & access",
    items: [
      { href: "/admin/account", icon: KeyRound, tone: "slate", title: "Account & password", text: "Your sign-in details" },
      { href: "/admin/staff?access=cashier", icon: UserCog, tone: "teal", title: "Cashiers", text: "Staff who can sign in and collect fees" },
      { href: "/admin/notices/settings", icon: MessageCircle, tone: "emerald", title: "WhatsApp & SMS", text: "Message provider and sender details" },
    ],
  },
];

/** One place for everything that is set up once and changed rarely. */
export default async function SettingsPage() {
  const school = await getCurrentSchool();
  const [viewer, theme] = await Promise.all([getViewer(), getTheme()]);
  return (
    <>
      <PageHeader title="Settings" subtitle={`Set-up for ${school.name}. Things you change rarely live here.`} />

      <div className="space-y-8">
        <Card title="Appearance" icon={Palette} description="Applies to this browser. System follows your device's light or dark mode.">
          <ThemeToggle initial={theme} iconOnly={false} size="md" />
        </Card>

        {groups.map((g) => (
          <section key={g.title}>
            <h2 className="mb-3 text-eyebrow uppercase text-muted">{g.title}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {g.items
                .filter((i) => viewer?.kind === "admin" || i.href !== "/admin/account")
                .map((i) => (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      className="group flex h-full items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift"
                    >
                      <IconTile icon={i.icon} tone={i.tone} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-fg">{i.title}</span>
                        <span className="block text-sm text-muted">{i.text}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-subtle transition group-hover:translate-x-0.5 group-hover:text-accent-text" />
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
