import { useEffect, useRef } from "react";

/**
 * Lightweight matrix-style code rain background, tuned for a light theme.
 * Subtle (low opacity) so it sits behind hero content without overpowering it.
 */
const CodeRain = ({ className = "" }: { className?: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0, h = 0;
    const FONT = 14;
    let columns = 0;
    let drops: number[] = [];

    const chars = "01<>{}[]/=+*-_$#@!?λΣπΔ";
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      columns = Math.floor(w / FONT);
      drops = new Array(columns).fill(0).map(() => Math.random() * -h);
    };

    const draw = () => {
      // soft fade to background-ish
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(0, 0, w, h);
      ctx.font = `${FONT}px ui-monospace, SFMono-Regular, Menlo, monospace`;

      for (let i = 0; i < columns; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        const x = i * FONT;
        const y = drops[i];
        // Color: light blue/purple alternating, low opacity
        const hue = (i * 7) % 60 + 200;
        ctx.fillStyle = `hsla(${hue}, 80%, 55%, 0.18)`;
        ctx.fillText(ch, x, y);
        if (y > h && Math.random() > 0.975) drops[i] = 0;
        drops[i] += FONT * 0.6;
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`absolute inset-0 w-full h-full pointer-events-none opacity-60 blur-[1px] ${className}`}
      style={{
        WebkitMaskImage:
          "linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 55%, rgba(0,0,0,0.15) 85%, rgba(0,0,0,0) 100%)",
        maskImage:
          "linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 55%, rgba(0,0,0,0.15) 85%, rgba(0,0,0,0) 100%)",
      }}
    />
  );
};

export default CodeRain;
