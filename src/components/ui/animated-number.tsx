"use client";

import { useLayoutEffect, useRef, useState } from "react";

const DURATION = 700;

/**
 * Counts up to `value` when first shown, and tweens when it changes. Renders
 * the final value on the server (and for reduced motion), with tabular digits
 * so the width doesn't jump while counting.
 */
export function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  locale = "en-IN",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  locale?: string;
}) {
  const [shown, setShown] = useState(value);
  // Where the next animation starts; updated only once an animation finishes.
  const from = useRef(0);

  useLayoutEffect(() => {
    const start = from.current;
    if (start === value || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = value;
      setShown(value);
      return;
    }
    let frame = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / DURATION);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    setShown(start);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <span className="tabular-nums">
      <span className="sr-only">
        {prefix}
        {value.toLocaleString(locale)}
        {suffix}
      </span>
      <span aria-hidden>
        {prefix}
        {shown.toLocaleString(locale)}
        {suffix}
      </span>
    </span>
  );
}
