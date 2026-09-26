"use client";

import { History, Send, Settings2 } from "lucide-react";
import { NavTabs } from "@/components/ui";

export function NoticesTabs() {
  return (
    <NavTabs
      tabs={[
        { href: "/admin/notices", label: "Send notice", icon: Send, match: (p) => p === "/admin/notices" },
        { href: "/admin/notices/sent", label: "Sent", icon: History, match: (p) => p === "/admin/notices/sent" || /^\/admin\/notices\/c/.test(p) },
        { href: "/admin/notices/settings", label: "WhatsApp & SMS settings", icon: Settings2 },
      ]}
    />
  );
}
