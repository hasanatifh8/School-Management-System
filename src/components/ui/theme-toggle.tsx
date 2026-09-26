"use client";

import { useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_COOKIE, type Theme } from "@/lib/theme";
import { SegmentedControl } from "./segmented";

/** System / Light / Dark switch. Applies instantly and is remembered for a year. */
export function ThemeToggle({
  initial,
  iconOnly = true,
  size = "sm",
}: {
  /** The saved choice, read on the server with getTheme(). */
  initial: Theme;
  iconOnly?: boolean;
  size?: "sm" | "md";
}) {
  const [theme, setTheme] = useState<Theme>(initial);

  function choose(next: Theme) {
    setTheme(next);
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    const root = document.documentElement;
    if (next === "system") delete root.dataset.theme;
    else root.dataset.theme = next;
  }

  return (
    <SegmentedControl
      label="Colour theme"
      value={theme}
      onChange={choose}
      size={size}
      iconOnly={iconOnly}
      options={[
        { value: "system", label: "System", icon: Monitor },
        { value: "light", label: "Light", icon: Sun },
        { value: "dark", label: "Dark", icon: Moon },
      ]}
    />
  );
}
