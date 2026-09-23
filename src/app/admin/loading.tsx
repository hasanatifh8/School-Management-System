export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="mb-8 space-y-3">
        <div className="h-8 w-48 rounded-lg bg-slate-200/80" />
        <div className="h-4 w-72 rounded bg-slate-200/60" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80" />
        ))}
      </div>
      <div className="mt-6 h-80 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80" />
    </div>
  );
}
