/** A school's logo, or its initials when it has none. */
export function SchoolLogo({ name, url, size = "md" }: { name: string; url: string | null; size?: "sm" | "md" | "lg" }) {
  const box = { sm: "h-9 w-9 text-xs", md: "h-12 w-12 text-base", lg: "h-16 w-16 text-xl" }[size];
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- served from our own API route
      <img src={url} alt={`${name} logo`} className={`${box} shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1`} />
    );
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span
      className={`${box} flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 font-semibold text-white`}
    >
      {initials}
    </span>
  );
}
