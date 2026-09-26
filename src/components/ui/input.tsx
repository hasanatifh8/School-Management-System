// Form control classes. Inputs are 16px on phones (so iOS doesn't zoom in) and 14px from `sm`.

export const inputClass =
  "block w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.25 text-base text-fg shadow-card placeholder:text-subtle transition sm:text-sm hover:border-subtle/60 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted aria-invalid:border-danger aria-invalid:ring-danger/15";

export const selectClass = `${inputClass} select-chevron`;

export const checkboxClass =
  "h-4 w-4 shrink-0 cursor-pointer rounded border-line-strong accent-accent disabled:cursor-not-allowed";
