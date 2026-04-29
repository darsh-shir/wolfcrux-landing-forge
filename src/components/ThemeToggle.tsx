import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "wolfcrux-theme";

type Theme = "light" | "dark";

const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return "light";
};

const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  }
};

const ThemeToggle = () => {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode (OLED)"}
      title={isDark ? "Light mode" : "Dark mode (OLED)"}
      className={[
        "relative inline-flex h-8 w-[60px] shrink-0 items-center rounded-full",
        "border transition-colors duration-300 ease-out",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isDark
          ? "bg-black border-[hsl(140_100%_45%/0.5)] shadow-[0_0_10px_hsl(140_100%_45%/0.35)]"
          : "bg-secondary border-border",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full",
          "transition-all duration-300 ease-out",
          isDark
            ? "left-[30px] bg-[hsl(140_100%_45%)] text-black shadow-[0_0_10px_hsl(140_100%_45%/0.7)]"
            : "left-1 bg-background text-foreground shadow",
        ].join(" ")}
      >
        {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
};

export default ThemeToggle;
