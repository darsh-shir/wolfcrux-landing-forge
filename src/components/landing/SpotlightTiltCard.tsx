import { useRef, ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  tilt?: boolean;
  spotlight?: boolean;
}

const SpotlightTiltCard = ({
  children,
  className = "",
  tilt = true,
  spotlight = true,
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    if (spotlight) {
      el.style.setProperty("--mx", `${px * 100}%`);
      el.style.setProperty("--my", `${py * 100}%`);
    }
    if (tilt) {
      const rx = (0.5 - py) * 8; // deg
      const ry = (px - 0.5) * 10;
      el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-2px)`;
    }
  };

  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    if (tilt) el.style.transform = "perspective(900px) rotateX(0) rotateY(0)";
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`spotlight-card ${className}`}
      style={{
        transition: "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
        transformStyle: "preserve-3d",
      }}
    >
      {children}
    </div>
  );
};

export default SpotlightTiltCard;
