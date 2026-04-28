const AuroraBackground = ({ className = "" }: { className?: string }) => {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {/* Soft floating color blobs */}
      <div className="absolute -top-32 -left-24 w-[42rem] h-[42rem] rounded-full opacity-40 blur-3xl animate-aurora-1"
        style={{ background: "radial-gradient(closest-side, hsl(220 90% 55% / 0.55), transparent 70%)" }}
      />
      <div className="absolute top-1/3 -right-32 w-[36rem] h-[36rem] rounded-full opacity-35 blur-3xl animate-aurora-2"
        style={{ background: "radial-gradient(closest-side, hsl(265 85% 60% / 0.5), transparent 70%)" }}
      />
      <div className="absolute -bottom-40 left-1/3 w-[38rem] h-[38rem] rounded-full opacity-30 blur-3xl animate-aurora-3"
        style={{ background: "radial-gradient(closest-side, hsl(190 95% 50% / 0.5), transparent 70%)" }}
      />
      {/* Subtle dot grid */}
      <div className="absolute inset-0 opacity-[0.18] mix-blend-multiply"
        style={{
          backgroundImage: "radial-gradient(hsl(var(--foreground) / 0.18) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
        }}
      />
    </div>
  );
};

export default AuroraBackground;
