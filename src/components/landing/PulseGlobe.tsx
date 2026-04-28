/**
 * Animated decorative globe with orbiting ping dots — used on Contact page.
 * Pure SVG, lightweight, themed via CSS HSL tokens.
 */
const PulseGlobe = ({ className = "" }: { className?: string }) => {
  return (
    <div className={`relative ${className}`} aria-hidden>
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <defs>
          <radialGradient id="globe-fill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(220 90% 55% / 0.18)" />
            <stop offset="100%" stopColor="hsl(220 90% 55% / 0)" />
          </radialGradient>
          <linearGradient id="globe-ring" x1="0" x2="1">
            <stop offset="0%" stopColor="hsl(220 90% 55%)" />
            <stop offset="100%" stopColor="hsl(265 85% 60%)" />
          </linearGradient>
        </defs>

        {/* glow disc */}
        <circle cx="100" cy="100" r="90" fill="url(#globe-fill)" />

        {/* outer rings */}
        <circle cx="100" cy="100" r="78" fill="none" stroke="url(#globe-ring)" strokeOpacity="0.45" strokeWidth="1" />
        <circle cx="100" cy="100" r="60" fill="none" stroke="url(#globe-ring)" strokeOpacity="0.35" strokeWidth="1" />
        <circle cx="100" cy="100" r="42" fill="none" stroke="url(#globe-ring)" strokeOpacity="0.25" strokeWidth="1" />

        {/* meridians (rotating slowly) */}
        <g style={{ transformOrigin: "100px 100px", animation: "rotate-slow 22s linear infinite" }}>
          <ellipse cx="100" cy="100" rx="78" ry="30" fill="none" stroke="url(#globe-ring)" strokeOpacity="0.35" />
          <ellipse cx="100" cy="100" rx="78" ry="55" fill="none" stroke="url(#globe-ring)" strokeOpacity="0.25" />
        </g>

        {/* pinging location dots */}
        {[
          { cx: 60, cy: 70, delay: "0s" },
          { cx: 140, cy: 90, delay: "0.8s" },
          { cx: 110, cy: 140, delay: "1.6s" },
          { cx: 70, cy: 130, delay: "2.4s" },
        ].map((p, i) => (
          <g key={i}>
            <circle cx={p.cx} cy={p.cy} r="2.5" fill="hsl(220 90% 55%)" />
            <circle
              cx={p.cx}
              cy={p.cy}
              r="2.5"
              fill="none"
              stroke="hsl(220 90% 55%)"
              strokeOpacity="0.7"
              style={{
                transformOrigin: `${p.cx}px ${p.cy}px`,
                animation: `globe-ping 2.4s ease-out ${p.delay} infinite`,
              }}
            />
          </g>
        ))}
      </svg>
    </div>
  );
};

export default PulseGlobe;
