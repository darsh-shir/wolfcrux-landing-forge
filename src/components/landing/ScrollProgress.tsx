import { useEffect, useState } from "react";

const ScrollProgress = () => {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const total = h.scrollHeight - h.clientHeight;
      const p = total > 0 ? (h.scrollTop / total) * 100 : 0;
      setPct(p);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-[3px] bg-transparent pointer-events-none">
      <div
        className="h-full origin-left transition-[width] duration-150 ease-out"
        style={{
          width: `${pct}%`,
          background:
            "linear-gradient(90deg, hsl(220 90% 55%), hsl(265 85% 60%), hsl(190 95% 50%))",
          boxShadow: "0 0 12px hsl(220 90% 55% / 0.5)",
        }}
      />
    </div>
  );
};

export default ScrollProgress;
