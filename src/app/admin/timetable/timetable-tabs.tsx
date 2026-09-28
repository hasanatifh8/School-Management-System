"use client";

import { Bell, School, Users } from "lucide-react";
import { NavTabs } from "@/components/ui";

/** Tabs across the Timetable section. */
export function TimetableTabs() {
  return (
    <NavTabs
      tabs={[
        { href: "/admin/timetable", label: "Classes", icon: School, match: (p) => p === "/admin/timetable" || p.startsWith("/admin/timetable/class") },
        { href: "/admin/timetable/teachers", label: "Teachers", icon: Users },
        { href: "/admin/timetable/periods", label: "Bell schedule", icon: Bell },
      ]}
    />
  );
}
