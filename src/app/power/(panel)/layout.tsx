import type { Metadata } from "next";
import { Activity, Building2, ExternalLink, ShieldCheck } from "lucide-react";
import { AccountCard, AppShell } from "@/components/ui";
import { requirePowerAdmin } from "@/lib/power-auth";
import { getTheme } from "@/lib/theme-server";
import { powerLogout } from "../actions";

export const metadata: Metadata = { title: "Power Admin" };
export const dynamic = "force-dynamic";

export default async function PowerLayout({ children }: LayoutProps<"/power">) {
  await requirePowerAdmin();
  const theme = await getTheme();
  return (
    <AppShell
      brand={{
        logo: (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-violet-400 text-white shadow-accent">
            <ShieldCheck className="h-5 w-5" />
          </span>
        ),
        title: "Power Admin",
        subtitle: "All schools",
      }}
      groups={[
        {
          items: [
            { href: "/power", label: "Schools", icon: <Building2 />, exact: true, alsoActive: ["/power/schools"] },
            { href: "/power/activity", label: "Activity log", icon: <Activity /> },
          ],
        },
      ]}
      footerItems={[{ href: "/admin", label: "Admin Portal", icon: <ExternalLink /> }]}
      mobileTabs={["/power", "/power/activity", "/admin"]}
      account={<AccountCard name="Power Admin" detail="Full access" signOut={powerLogout} theme={theme} />}
    >
      {children}
    </AppShell>
  );
}
