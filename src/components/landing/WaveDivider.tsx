interface Props {
  flip?: boolean;
  className?: string;
}

const WaveDivider = ({ flip = false, className = "" }: Props) => {
  return (
    <div
      aria-hidden
      className={`relative w-full overflow-hidden leading-[0] ${className}`}
      style={{ transform: flip ? "rotate(180deg)" : undefined }}
    >
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="block w-[200%] h-16 md:h-24 animate-wave-slow"
      >
        <defs>
          <linearGradient id="wave-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="hsl(220 90% 55%)" stopOpacity="0.18" />
            <stop offset="50%" stopColor="hsl(265 85% 60%)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="hsl(190 95% 50%)" stopOpacity="0.18" />
          </linearGradient>
        </defs>
        <path
          d="M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z"
          fill="url(#wave-grad)"
        />
        <path
          d="M0,80 C240,30 480,130 720,80 C960,30 1200,130 1440,80 L1440,120 L0,120 Z"
          fill="url(#wave-grad)"
          opacity="0.6"
        />
      </svg>
    </div>
  );
};

export default WaveDivider;
