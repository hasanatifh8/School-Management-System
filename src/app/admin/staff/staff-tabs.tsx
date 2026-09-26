"use client";

import { KeyRound, UserCog } from "lucide-react";
import { NavTabs } from "@/components/ui";

export function StaffTabs() {
  return (
    <NavTabs
      tabs={[
        { href: "/admin/staff", label: "Non-teaching staff", icon: UserCog, match: (p) => p === "/admin/staff" },
        { href: "/admin/staff/logins", label: "Fees logins", icon: KeyRound },
      ]}
    />
  );
}
