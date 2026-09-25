"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarCheck, IdCard, Megaphone, KeyRound, LayoutDashboard, Users } from "lucide-react";

type Item = { href: string; label: string; icon: typeof Users; sub?: string };

export function TeacherNav({ myClass, subjectSections }: { myClass: string | null; subjectSections: { id: string; label: string; subjects: string }[] }) {
  const pathname = usePathname();
  const items: Item[] = [
    { href: "/teacher", label: "Dashboard", icon: LayoutDashboard },
    ...(myClass
      ? [
          { href: "/teacher/class", label: "My class", icon: Users, sub: myClass },
          { href: "/teacher/attendance", label: "Attendance", icon: CalendarCheck },
          { href: "/teacher/notices", label: "Notices", icon: Megaphone },
          { href: "/teacher/id-cards", label: "ID cards", icon: IdCard },
        ]
      : []),
    ...subjectSections.map((s) => ({ href: `/teacher/sections/${s.id}`, label: s.label, icon: BookOpen, sub: s.subjects })),
    { href: "/teacher/account", label: "Account", icon: KeyRound },
  ];
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col">
      {items.map(({ href, label, icon: Icon, sub }) => {
        const active =
          href === "/teacher"
            ? pathname === href
            : pathname.startsWith(href) || (href === "/teacher/class" && pathname.startsWith("/teacher/students"));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`group relative flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
            }`}
          >
            {active && <span className="absolute inset-y-1.5 left-0 hidden w-0.5 rounded-full bg-teal-400 lg:block" />}
            <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-teal-300" : "text-slate-500 group-hover:text-slate-300"}`} />
            <span className="min-w-0">
              <span className="block truncate">{label}</span>
              {sub && <span className="hidden truncate text-[11px] font-normal text-slate-500 lg:block">{sub}</span>}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
