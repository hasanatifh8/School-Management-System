import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import type { Theme } from "@/lib/theme";
import { Avatar } from "./data";
import { ThemeToggle } from "./theme-toggle";

/**
 * Signed-in user block at the foot of the sidebar: who, theme switch and sign
 * out. Collapses to just the avatar on the tablet rail.
 */
export function AccountCard({
  name,
  detail,
  photoUrl,
  signOut,
  theme,
}: {
  name: string;
  detail?: ReactNode;
  photoUrl?: string | null;
  /** A server action; omitted when the viewer can't sign out here. */
  signOut?: () => Promise<void>;
  theme: Theme;
}) {
  return (
    <div className="rounded-2xl bg-surface-2 p-3 md:max-lg:bg-transparent md:max-lg:p-0">
      <div className="flex items-center gap-3 md:max-lg:justify-center">
        <span title={name}>
          <Avatar name={name} src={photoUrl} size="sm" />
        </span>
        <div className="min-w-0 flex-1 md:max-lg:hidden">
          <p className="truncate text-sm font-medium text-fg">{name}</p>
          {detail && <p className="truncate text-xs text-muted">{detail}</p>}
        </div>
        {signOut && (
          <form action={signOut} className="md:max-lg:hidden">
            <button
              title="Sign out"
              aria-label="Sign out"
              className="rounded-lg p-1.5 text-subtle transition hover:bg-surface-3 hover:text-danger"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>
      <div className="mt-3 md:max-lg:hidden">
        <ThemeToggle initial={theme} />
      </div>
    </div>
  );
}
