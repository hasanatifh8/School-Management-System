import { Check } from "lucide-react";
import { cx } from "@/components/ui";

const STEPS = ["Student details", "Transport", "Fees", "Acknowledgement"] as const;

/** Where the user is in the admission: details → transport → fees → acknowledgement. */
export function AdmissionSteps({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="mb-6 flex items-center gap-2 sm:gap-3" aria-label="Admission steps">
      {STEPS.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const here = step === current;
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3" aria-current={here ? "step" : undefined}>
            <span
              className={cx(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                done && "bg-success-soft text-success",
                here && "bg-accent text-accent-fg shadow-card",
                !done && !here && "border border-line-strong text-muted",
              )}
            >
              {done ? <Check className="h-4 w-4" aria-hidden /> : step}
            </span>
            <span className={cx("truncate text-sm", here ? "font-semibold text-fg" : "text-muted")}>{label}</span>
            {step < STEPS.length && <span className="h-px min-w-4 flex-1 bg-line" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
