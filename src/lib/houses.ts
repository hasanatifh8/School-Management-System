// House colour palette. Class names are written out in full so Tailwind includes them.

export const HOUSE_COLORS = {
  red: {
    label: "Red",
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-700 ring-red-200",
    banner: "from-red-500 to-rose-600",
    soft: "bg-red-50",
    text: "text-red-700",
  },
  green: {
    label: "Green",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    banner: "from-emerald-500 to-green-600",
    soft: "bg-emerald-50",
    text: "text-emerald-700",
  },
  blue: {
    label: "Blue",
    dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-700 ring-blue-200",
    banner: "from-blue-500 to-indigo-600",
    soft: "bg-blue-50",
    text: "text-blue-700",
  },
  yellow: {
    label: "Yellow",
    dot: "bg-amber-400",
    badge: "bg-amber-50 text-amber-800 ring-amber-200",
    banner: "from-amber-400 to-yellow-500",
    soft: "bg-amber-50",
    text: "text-amber-800",
  },
  orange: {
    label: "Orange",
    dot: "bg-orange-500",
    badge: "bg-orange-50 text-orange-700 ring-orange-200",
    banner: "from-orange-500 to-amber-600",
    soft: "bg-orange-50",
    text: "text-orange-700",
  },
  purple: {
    label: "Purple",
    dot: "bg-violet-500",
    badge: "bg-violet-50 text-violet-700 ring-violet-200",
    banner: "from-violet-500 to-purple-600",
    soft: "bg-violet-50",
    text: "text-violet-700",
  },
  pink: {
    label: "Pink",
    dot: "bg-pink-500",
    badge: "bg-pink-50 text-pink-700 ring-pink-200",
    banner: "from-pink-500 to-rose-500",
    soft: "bg-pink-50",
    text: "text-pink-700",
  },
  teal: {
    label: "Teal",
    dot: "bg-teal-500",
    badge: "bg-teal-50 text-teal-700 ring-teal-200",
    banner: "from-teal-500 to-cyan-600",
    soft: "bg-teal-50",
    text: "text-teal-700",
  },
  gray: {
    label: "Gray",
    dot: "bg-slate-500",
    badge: "bg-slate-100 text-slate-700 ring-slate-200",
    banner: "from-slate-500 to-slate-700",
    soft: "bg-slate-100",
    text: "text-slate-700",
  },
} as const;

export type HouseColor = keyof typeof HOUSE_COLORS;

export const HOUSE_COLOR_KEYS = Object.keys(HOUSE_COLORS) as HouseColor[];

/** Palette entry for a stored colour key, falling back to gray. */
export function houseColor(key: string) {
  return HOUSE_COLORS[key as HouseColor] ?? HOUSE_COLORS.gray;
}
