"use client";

import { HandCoins, LayoutGrid, ListTree, Receipt } from "lucide-react";
import { NavTabs } from "@/components/ui";

/** Tabs across the Fees section. "Fee structure" is for admins only. */
export function FeesTabs({ canManage }: { canManage: boolean }) {
  return (
    <NavTabs
      tabs={[
        { href: "/admin/fees", label: "Overview", icon: LayoutGrid, match: (p) => p === "/admin/fees" },
        { href: "/admin/fees/collect", label: "Collect fees", icon: HandCoins, match: (p) => p.startsWith("/admin/fees/collect") || p.startsWith("/admin/fees/students") },
        { href: "/admin/fees/receipts", label: "Receipts", icon: Receipt },
        { href: "/admin/fees/structure", label: canManage ? "Fee structure" : "Fee chart", icon: ListTree },
      ]}
    />
  );
}
