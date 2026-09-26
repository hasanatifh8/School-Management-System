// House colour palette. Class names are written out in full so Tailwind includes them.

export const HOUSE_COLORS = {
  red: {
    label: "Red",
    dot: "bg-red-500",
    badge: "bg-red-500/12 text-red-700 dark:text-red-300 ring-red-500/25",
    banner: "from-red-500 to-rose-600",
    soft: "bg-red-500/12",
    text: "text-red-700 dark:text-red-300",
  },
  green: {
    label: "Green",
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 ring-emerald-500/25",
    banner: "from-emerald-500 to-green-600",
    soft: "bg-emerald-500/12",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  blue: {
    label: "Blue",
    dot: "bg-blue-500",
    badge: "bg-blue-500/12 text-blue-700 dark:text-blue-300 ring-blue-500/25",
    banner: "from-blue-500 to-indigo-600",
    soft: "bg-blue-500/12",
    text: "text-blue-700 dark:text-blue-300",
  },
  yellow: {
    label: "Yellow",
    dot: "bg-amber-400",
    badge: "bg-amber-500/12 text-amber-800 dark:text-amber-300 ring-amber-500/25",
    banner: "from-amber-400 to-yellow-500",
    soft: "bg-amber-500/12",
    text: "text-amber-800 dark:text-amber-300",
  },
  orange: {
    label: "Orange",
    dot: "bg-orange-500",
    badge: "bg-orange-500/12 text-orange-700 dark:text-orange-300 ring-orange-500/25",
    banner: "from-orange-500 to-amber-600",
    soft: "bg-orange-500/12",
    text: "text-orange-700 dark:text-orange-300",
  },
  purple: {
    label: "Purple",
    dot: "bg-violet-500",
    badge: "bg-violet-500/12 text-violet-700 dark:text-violet-300 ring-violet-500/25",
    banner: "from-violet-500 to-purple-600",
    soft: "bg-violet-500/12",
    text: "text-violet-700 dark:text-violet-300",
  },
  pink: {
    label: "Pink",
    dot: "bg-pink-500",
    badge: "bg-pink-500/12 text-pink-700 dark:text-pink-300 ring-pink-500/25",
    banner: "from-pink-500 to-rose-500",
    soft: "bg-pink-500/12",
    text: "text-pink-700 dark:text-pink-300",
  },
  teal: {
    label: "Teal",
    dot: "bg-teal-500",
    badge: "bg-teal-500/12 text-teal-700 dark:text-teal-300 ring-teal-500/25",
    banner: "from-teal-500 to-cyan-600",
    soft: "bg-teal-500/12",
    text: "text-teal-700 dark:text-teal-300",
  },
  gray: {
    label: "Gray",
    dot: "bg-slate-500",
    badge: "bg-slate-500/12 text-slate-700 dark:text-slate-300 ring-slate-500/25",
    banner: "from-slate-500 to-slate-700",
    soft: "bg-slate-500/12",
    text: "text-slate-700 dark:text-slate-300",
  },
} as const;

export type HouseColor = keyof typeof HOUSE_COLORS;

export const HOUSE_COLOR_KEYS = Object.keys(HOUSE_COLORS) as HouseColor[];

/** Palette entry for a stored colour key, falling back to gray. */
export function houseColor(key: string) {
  return HOUSE_COLORS[key as HouseColor] ?? HOUSE_COLORS.gray;
}
