"use client";

import { usePathname } from "next/navigation";
import { Breadcrumbs, type Crumb } from "@/components/ui";

/**
 * Back button and trail for the tab pages of a shared layout header:
 * shows the crumbs listed for the current path, nothing on other tabs.
 */
export function TabCrumbs({ crumbs }: { crumbs: Record<string, Crumb[]> }) {
  const items = crumbs[usePathname()];
  return items ? <Breadcrumbs items={items} /> : null;
}
