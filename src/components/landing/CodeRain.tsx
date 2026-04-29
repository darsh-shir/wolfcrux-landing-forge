import { useEffect, useRef } from "react";

/**
 * Lightweight matrix-style code rain background, tuned for a light theme.
 * Fixed-position so it spans the whole page; opacity is faded via a vertical
 * mask so it gracefully blends into the page background further down.
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
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      columns = Math.floor(w / FONT);
      drops = new Array(columns).fill(0).map(() => Math.random() * -h);
    };

    const draw = () => {
      const isDark = document.documentElement.classList.contains("dark");
      // soft trail fade — match the page background so the canvas blends in
      ctx.fillStyle = isDark ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.10)";
      ctx.fillRect(0, 0, w, h);
      ctx.font = `${FONT}px ui-monospace, SFMono-Regular, Menlo, monospace`;

      for (let i = 0; i < columns; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        const x = i * FONT;
        const y = drops[i];
        // In dark mode, switch to Bloomberg-green glyphs; in light, the original blue/cyan
        const hue = isDark ? 140 : ((i * 7) % 60 + 200);
        const sat = isDark ? 100 : 80;
        const light = isDark ? 55 : 50;
        const alpha = isDark ? 0.55 : 0.35;
        ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
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
      className={`fixed inset-0 w-screen h-screen pointer-events-none z-0 ${className}`}
      style={{
        WebkitMaskImage:
          "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.25) 65%, rgba(0,0,0,0.08) 85%, rgba(0,0,0,0) 100%)",
        maskImage:
          "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.25) 65%, rgba(0,0,0,0.08) 85%, rgba(0,0,0,0) 100%)",
      }}
    />
  );
};

export default CodeRain;
