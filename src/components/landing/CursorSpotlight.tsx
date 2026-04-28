import { useEffect, useRef } from "react";

interface Props {
  className?: string;
  size?: number;
  color?: string;
}

const CursorSpotlight = ({
  className = "",
  size = 520,
  color = "hsl(220 90% 55% / 0.18)",
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;

    const onMove = (e: MouseEvent) => {
      const r = parent.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      el.style.background = `radial-gradient(${size}px circle at ${x}px ${y}px, ${color}, transparent 60%)`;
    };
    const onLeave = () => {
      el.style.background = "transparent";
    };

    parent.addEventListener("mousemove", onMove);
    parent.addEventListener("mouseleave", onLeave);
    return () => {
      parent.removeEventListener("mousemove", onMove);
      parent.removeEventListener("mouseleave", onLeave);
    };
  }, [size, color]);

  return (
    <div
      ref={ref}
      aria-hidden
      className={`pointer-events-none absolute inset-0 transition-[background] duration-200 ${className}`}
    />
  );
};

export default CursorSpotlight;
