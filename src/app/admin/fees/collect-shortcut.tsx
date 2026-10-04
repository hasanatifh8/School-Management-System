"use client";

import { usePathname } from "next/navigation";
import { HandCoins } from "lucide-react";
import { ButtonLink } from "@/components/ui";

/** The header's "Collect fee" shortcut, hidden where you are already collecting. */
export function CollectShortcut() {
  const path = usePathname();
  if (path.startsWith("/admin/fees/collect") || path.startsWith("/admin/fees/students")) return null;
  return (
    <ButtonLink href="/admin/fees/collect" icon={HandCoins}>
      Collect fee
    </ButtonLink>
  );
}
