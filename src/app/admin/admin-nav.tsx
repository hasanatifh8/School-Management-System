"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarCheck, IdCard, CalendarRange, GraduationCap, LayoutDashboard, Presentation, School, Shield } from "lucide-react";

const items = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/students", label: "Students", icon: GraduationCap },
  { href: "/admin/teachers", label: "Teachers", icon: Presentation },
  { href: "/admin/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/admin/id-cards", label: "ID cards", icon: IdCard },
  { href: "/admin/classes", label: "Classes", icon: School },
  { href: "/admin/subjects", label: "Subjects", icon: BookOpen },
  { href: "/admin/houses", label: "Houses", icon: Shield },
  { href: "/admin/sessions", label: "Sessions", icon: CalendarRange },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`group relative flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-white/10 text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
            }`}
          >
            {active && (
              <span className="absolute inset-y-1.5 left-0 hidden w-0.5 rounded-full bg-indigo-400 lg:block" />
            )}
            <Icon className={`h-[18px] w-[18px] ${active ? "text-indigo-300" : "text-slate-500 group-hover:text-slate-300"}`} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
