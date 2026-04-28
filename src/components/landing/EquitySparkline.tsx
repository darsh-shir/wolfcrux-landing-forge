import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  width?: number;
  height?: number;
  className?: string;
}

// Deterministic-ish upward random walk so it looks like an equity curve
const buildPoints = (n: number, w: number, h: number) => {
  let v = 0;
  const series: number[] = [];
  for (let i = 0; i < n; i++) {
    v += (Math.random() - 0.42) * 6;
    series.push(v);
  }
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = Math.max(1, max - min);
  return series.map((y, i) => {
    const x = (i / (n - 1)) * w;
    const yy = h - ((y - min) / range) * (h - 8) - 4;
    return [x, yy] as [number, number];
  });
};

const toPath = (pts: [number, number][]) =>
  pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");

const EquitySparkline = ({
  width = 600,
  height = 160,
  className = "",
}: Props) => {
  const [drawn, setDrawn] = useState(false);
  const ref = useRef<SVGSVGElement>(null);

  const points = useMemo(() => buildPoints(60, width, height), [width, height]);
  const path = useMemo(() => toPath(points), [points]);
  const areaPath = useMemo(
    () => `${path} L ${width} ${height} L 0 ${height} Z`,
    [path, width, height]
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          setDrawn(true);
          obs.unobserve(el);
        }
      });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${width} ${height}`}
      className={`w-full h-full ${className}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(220 90% 55%)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="hsl(220 90% 55%)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="eq-stroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="hsl(220 90% 55%)" />
          <stop offset="50%" stopColor="hsl(265 85% 60%)" />
          <stop offset="100%" stopColor="hsl(190 95% 50%)" />
        </linearGradient>
      </defs>
      <path
        d={areaPath}
        fill="url(#eq-fill)"
        style={{
          opacity: drawn ? 1 : 0,
          transition: "opacity 1.2s ease 0.4s",
        }}
      />
      <path
        d={path}
        fill="none"
        stroke="url(#eq-stroke)"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 4000,
          strokeDashoffset: drawn ? 0 : 4000,
          transition: "stroke-dashoffset 2.4s cubic-bezier(0.22, 1, 0.36, 1)",
          filter: "drop-shadow(0 4px 12px hsl(220 90% 55% / 0.35))",
        }}
      />
    </svg>
  );
};

export default EquitySparkline;
