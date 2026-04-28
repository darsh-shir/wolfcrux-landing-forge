import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  /** Format the current numeric value into a display string. */
  format: (n: number) => string;
  /** Animation duration in ms. */
  duration?: number;
  className?: string;
  /**
   * If provided, animation re-runs whenever this key changes.
   * Otherwise it runs once on first viewport entry, then jumps to new values.
   */
  resetKey?: string | number;
}

/**
 * Generic count-up animation that respects an external formatter
 * (so it works with Indian numbering, currency prefixes, etc.).
 * Starts when the element scrolls into view.
 */
const AnimatedNumber = ({
  value,
  format,
  duration = 1400,
  className = "",
  resetKey,
}: AnimatedNumberProps) => {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useRef(false);
  const rafRef = useRef<number | null>(null);

  // Run the count-up animation from 0 -> value
  const runAnimation = (target: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (target - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(target);
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // Initial in-view trigger
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !seen.current) {
            seen.current = true;
            runAnimation(value);
            obs.unobserve(el);
          }
        });
      },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If value (or resetKey) changes after first run, jump or re-animate
  useEffect(() => {
    if (!seen.current) return;
    if (resetKey !== undefined) {
      runAnimation(value);
    } else {
      setDisplay(value);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, resetKey]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {format(display)}
    </span>
  );
};

export default AnimatedNumber;
