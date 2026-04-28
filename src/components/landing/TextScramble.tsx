import { useEffect, useRef, useState } from "react";

const CHARS = "!<>-_\\/[]{}—=+*^?#________";

interface Props {
  text: string;
  className?: string;
  duration?: number; // ms
}

const TextScramble = ({ text, className = "", duration = 1400 }: Props) => {
  const [out, setOut] = useState(text);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const start = performance.now();
    const len = text.length;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = t * t * (3 - 2 * t);
      const settled = Math.floor(eased * len);
      let s = "";
      for (let i = 0; i < len; i++) {
        if (i < settled || text[i] === " ") s += text[i];
        else s += CHARS[Math.floor(Math.random() * CHARS.length)];
      }
      setOut(s);
      if (t < 1) requestAnimationFrame(tick);
      else setOut(text);
    };
    requestAnimationFrame(tick);
  }, [text, duration]);

  return <span className={className}>{out}</span>;
};

export default TextScramble;
